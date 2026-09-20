import type { ApprovalDto, RuleBriefDto } from '@infraflow/shared';
import { type Db, type Queryable, withTx } from '../../platform/db.js';
import { type Actor, type RequestContext, can } from '../../platform/context.js';
import { audit } from '../../platform/audit.js';
import { emit } from '../../platform/events.js';
import { authorityNotResolved, conflict, forbidden, notFound, validation } from '../../platform/errors.js';
import * as projects from '../projects/projects.repo.js';
import * as wfRepo from '../workflows/workflows.repo.js';
import { completeNode } from '../workflows/workflows.service.js';
import { createTask } from '../workflows/task-factory.js';
import { UNRESOLVED_MESSAGE } from '../authority/authority.service.js';
import * as authRepo from '../authority/authority.repo.js';
import { getPositionBrief } from '../org/org.service.js';
import * as rulesRepo from '../rules/rules.repo.js';
import { toRuleDto } from '../rules/rules.service.js';
import * as repo from './approvals.repo.js';
import { createSubmitTask } from './approvals.activation.js';

const DAY = 86_400_000;

async function ruleBrief(db: Queryable, id: string | null): Promise<RuleBriefDto | null> {
  if (!id) return null;
  const r = await rulesRepo.getRuleById(db, id);
  if (!r) return null;
  const d = toRuleDto(r);
  return { id: d.id, ruleCode: d.ruleCode, name: d.name, trustBadge: d.trustBadge, statement: d.statement, synthetic: d.synthetic };
}

async function toDto(db: Queryable, actor: Actor, c: repo.CaseRow, now: Date): Promise<ApprovalDto> {
  const [position, nodeRule, authorityRule, docs, decisions] = await Promise.all([
    c.resolved_position_id ? getPositionBrief(db, c.resolved_position_id) : Promise.resolve(null),
    ruleBrief(db, c.node_rule_version_id),
    ruleBrief(db, c.authority_rule_version_id),
    repo.requiredDocsStatus(db, c.workflow_node_instance_id),
    repo.listDecisions(db, c.id),
  ]);
  const holdsSeat = !!c.resolved_position_id && actor.positions.some((p) => p.positionId === c.resolved_position_id);
  const resolvedOk = c.resolution_status === 'RESOLVED' || (c.resolution_status === 'MANUAL_REVIEW' && !!c.resolved_position_id);
  const open = ['PENDING', 'RETURNED', 'IN_REVIEW'].includes(c.status);
  const dueAt = c.node_due_at;
  const since = c.submitted_at ?? c.node_eligible_at ?? c.created_at;
  const requiresManualReview = c.resolution_status !== 'RESOLVED';

  return {
    id: c.id,
    projectId: c.project_id,
    projectCode: c.project_code,
    projectName: c.project_name,
    projectCost: c.project_cost,
    nodeCode: c.node_code,
    nodeName: c.node_name,
    approvalType: c.approval_type,
    status: c.status,
    submittedAt: c.submitted_at?.toISOString() ?? null,
    decidedAt: c.decided_at?.toISOString() ?? null,
    createdAt: c.created_at.toISOString(),
    dueAt: dueAt?.toISOString() ?? null,
    ageDays: Math.max(0, Math.floor((now.getTime() - since.getTime()) / DAY)),
    overdue: open && !!dueAt && dueAt.getTime() < now.getTime(),
    authority: {
      resolutionStatus: c.resolution_status,
      requiresManualReview,
      message: requiresManualReview ? UNRESOLVED_MESSAGE : null,
      position,
      ruleCode: c.authority_rule_code,
      rule: authorityRule,
      synthetic: c.authority_synthetic,
    },
    nodeRule,
    requiredDocuments: docs.map((d) => ({ code: d.code, name: d.name, status: d.status, required: d.required })),
    decisions: decisions.map((d) => ({
      id: d.id, action: d.action, reason: d.reason, at: d.created_at.toISOString(), actorName: d.actor_name,
      actorDesignation: d.actor_designation, actorPositionCode: d.actor_position_code,
    })),
    canSubmit: ['PENDING', 'RETURNED'].includes(c.status) && can(actor, 'project.update') && resolvedOk,
    canDecide: c.status === 'IN_REVIEW' && can(actor, 'approval.decide') && holdsSeat && c.submitted_by !== actor.userId,
    canManualAssign: open && requiresManualReview && can(actor, 'authority.manual_assign'),
    blockedReason: open && !resolvedOk ? UNRESOLVED_MESSAGE : null,
  };
}

async function loadVisibleCase(db: Queryable, actor: Actor, id: string): Promise<repo.CaseRow> {
  const c = await repo.getCase(db, id);
  if (!c || !(await projects.getProject(db, c.project_id, actor))) throw notFound('Approval');
  return c;
}

export async function listApprovals(db: Db, ctx: RequestContext, f: { status?: string; projectId?: string; mine?: boolean }): Promise<ApprovalDto[]> {
  const actor = ctx.actor!;
  const rows = await repo.listCases(db, actor, f);
  return Promise.all(rows.map((c) => toDto(db, actor, c, ctx.now)));
}

export async function getApproval(db: Db, ctx: RequestContext, id: string): Promise<ApprovalDto> {
  const c = await loadVisibleCase(db, ctx.actor!, id);
  return toDto(db, ctx.actor!, c, ctx.now);
}

/** A required document blocks submit/approve while it is MISSING or was REJECTED (SUBMITTED/VERIFIED both count as present). */
function missingDocs(docs: Awaited<ReturnType<typeof repo.requiredDocsStatus>>, _level: 'submit' | 'approve') {
  return docs.filter((d) => d.required && (d.status === 'MISSING' || d.status === 'REJECTED'));
}

/** PENDING/RETURNED -> IN_REVIEW. Refuses when authority is unresolved or required documents are missing. */
export async function submitApproval(db: Db, ctx: RequestContext, id: string): Promise<ApprovalDto> {
  const actor = ctx.actor!;
  await withTx(db, async (tx) => {
    const pre = await loadVisibleCase(tx, actor, id);
    await projects.lockProject(tx, pre.project_id);
    const lock = await repo.lockCase(tx, id);
    if (!lock) throw notFound('Approval');
    const c = (await repo.getCase(tx, id))!;
    if (!['PENDING', 'RETURNED'].includes(c.status)) throw conflict(`This approval cannot be submitted (current status: ${c.status}).`);
    const resolvedOk = c.resolution_status === 'RESOLVED' || (c.resolution_status === 'MANUAL_REVIEW' && !!c.resolved_position_id);
    if (!resolvedOk || !c.resolved_position_id) throw authorityNotResolved(UNRESOLVED_MESSAGE, { resolutionStatus: c.resolution_status });
    const holder = (await getPositionBrief(tx, c.resolved_position_id))?.holder;
    if (!holder) throw authorityNotResolved('The competent position currently has no active holder. No automatic assignment was made.', { resolutionStatus: 'INACTIVE_POSITION' });

    const docs = await repo.requiredDocsStatus(tx, c.workflow_node_instance_id);
    const missing = missingDocs(docs, 'submit');
    if (missing.length) throw validation('Required documents are missing.', missing.map((d) => ({ field: d.code, message: `${d.name} is ${d.status.toLowerCase()}` })));

    const node = (await wfRepo.getNode(tx, c.workflow_node_instance_id))!;
    await projects.lockProject(tx, c.project_id);
    await repo.updateCase(tx, id, { status: 'IN_REVIEW', submittedAt: ctx.now, submittedBy: actor.userId, at: ctx.now });
    await repo.insertDecision(tx, { caseId: id, action: 'SUBMIT', actorUserId: actor.userId, actorPositionId: actor.positions[0]?.positionId ?? null, at: ctx.now });
    await wfRepo.updateNode(tx, node.id, { activation_state: 'ACTIVE', execution_state: 'IN_PROGRESS', started_at: node.started_at ?? ctx.now });
    await wfRepo.insertTransition(tx, {
      nodeId: node.id, fromActivation: node.activation_state, toActivation: 'ACTIVE', fromExecution: node.execution_state, toExecution: 'IN_PROGRESS',
      actorUserId: actor.userId, reason: 'APPROVAL_SUBMITTED', at: ctx.now,
    });
    await wfRepo.completeOpenTasks(tx, node.id, ['APPROVAL_SUBMIT'], ctx.now);
    await createTask(tx, ctx, {
      projectId: c.project_id, projectCode: c.project_code, nodeId: node.id, taskType: 'APPROVAL_DECISION', title: `Decide: ${c.node_name}`,
      description: `${c.project_code} - ${c.project_name}. Review the documents and decide (approve, return or reject).`,
      priority: 'HIGH', assignedPositionId: c.resolved_position_id, ruleVersionId: node.source_rule_version_id, dueAt: node.due_at,
      link: `/approvals/${id}`,
    });
    await audit(tx, ctx, {
      action: 'approval.submitted', entityType: 'approval_case', entityId: id, projectId: c.project_id,
      oldData: { status: c.status }, newData: { status: 'IN_REVIEW' }, metadata: { nodeCode: c.node_code, approverPosition: c.resolved_position_code },
    });
    await emit(tx, ctx, {
      aggregateType: 'PROJECT', aggregateId: c.project_id, eventType: 'ApprovalSubmitted',
      payload: { approvalCaseId: id, approvalType: c.approval_type, nodeCode: c.node_code, projectCode: c.project_code, approverPositionId: c.resolved_position_id },
    });
  });
  return getApproval(db, ctx, id);
}

export type DecisionAction = 'APPROVE' | 'RETURN' | 'REJECT' | 'REQUEST_INFORMATION';
const SANCTION_TYPES: Record<string, string> = { ADMINISTRATIVE_APPROVAL: 'ADMINISTRATIVE_APPROVAL', TECHNICAL_SANCTION: 'TECHNICAL_SANCTION' };

/**
 * The official human decision. Guard order (doc 07): authenticated + permission (route) -> project scope -> row lock ->
 * case IN_REVIEW (else 409) -> actor currently holds the resolved position -> separation of duties -> documents ->
 * apply -> decision row + transitions + audit + outbox in the SAME transaction.
 */
export async function decideApproval(db: Db, ctx: RequestContext, id: string, action: DecisionAction, reason?: string): Promise<ApprovalDto> {
  const actor = ctx.actor!;
  if (action !== 'APPROVE' && (!reason || reason.trim().length < 5)) {
    throw validation('A reason is required to return or reject an approval.', [{ field: 'reason', message: 'Enter a reason (min 5 characters).' }]);
  }
  await withTx(db, async (tx) => {
    const pre = await loadVisibleCase(tx, actor, id);
    await projects.lockProject(tx, pre.project_id);
    if (!(await repo.lockCase(tx, id))) throw notFound('Approval');
    const c = (await repo.getCase(tx, id))!;
    if (c.status !== 'IN_REVIEW') throw conflict(`This approval is no longer awaiting a decision (current status: ${c.status}).`, { status: c.status });
    if (!c.resolved_position_id) throw authorityNotResolved(UNRESOLVED_MESSAGE);
    if (!(await repo.actorHoldsPosition(tx, actor.userId, c.resolved_position_id))) {
      throw forbidden(`Only the current holder of the competent position (${c.resolved_designation ?? c.resolved_position_code ?? 'unknown'}) can decide this approval.`);
    }
    if (c.submitted_by && c.submitted_by === actor.userId) throw forbidden('The person who submitted an approval cannot also decide it.');

    const node = (await wfRepo.getNode(tx, c.workflow_node_instance_id))!;
    const project = (await projects.getProject(tx, c.project_id))!;
    const positionId = c.resolved_position_id;

    if (action === 'APPROVE') {
      const missing = missingDocs(await repo.requiredDocsStatus(tx, c.workflow_node_instance_id), 'approve');
      if (missing.length) throw validation('Required documents are missing or rejected.', missing.map((d) => ({ field: d.code, message: `${d.name} is ${d.status.toLowerCase()}` })));
    }

    const newStatus = action === 'APPROVE' ? 'APPROVED' : action === 'REJECT' ? 'REJECTED' : 'RETURNED';
    await repo.updateCase(tx, id, { status: newStatus, decision: action, reason: reason ?? null, decidedAt: ctx.now, at: ctx.now });
    await repo.insertDecision(tx, { caseId: id, action, actorUserId: actor.userId, actorPositionId: positionId, reason, at: ctx.now });
    await wfRepo.completeOpenTasks(tx, node.id, ['APPROVAL_DECISION'], ctx.now);

    if (action === 'APPROVE') {
      const type = SANCTION_TYPES[c.approval_type];
      if (type) {
        await repo.insertSanction(tx, {
          projectId: c.project_id, caseId: id, type, amount: project.estimated_cost,
          reference: `${c.project_code}/${type === 'ADMINISTRATIVE_APPROVAL' ? 'AA' : 'TS'}`, date: ctx.now.toISOString().slice(0, 10),
          ruleVersionId: node.source_rule_version_id, at: ctx.now,
        });
      }
      await completeNode(tx, ctx, node.id, 'APPROVAL_APPROVED', { approvalCaseId: id, approverPositionId: positionId });
    } else if (action === 'REJECT') {
      await wfRepo.updateNode(tx, node.id, {
        activation_state: 'BLOCKED', execution_state: 'REJECTED',
        blocking_reason: { type: 'APPROVAL_REJECTED', message: `Rejected: ${reason}`, approvalCaseId: id },
      });
      await wfRepo.insertTransition(tx, {
        nodeId: node.id, fromActivation: node.activation_state, toActivation: 'BLOCKED', fromExecution: node.execution_state, toExecution: 'REJECTED',
        actorUserId: actor.userId, reason: 'APPROVAL_REJECTED', metadata: { reason }, at: ctx.now,
      });
      await projects.lockProject(tx, c.project_id);
      await projects.setProjectState(tx, c.project_id, { operationalStatus: 'BLOCKED' }, ctx.now);
    } else {
      await wfRepo.updateNode(tx, node.id, { activation_state: 'ELIGIBLE', execution_state: 'RETURNED' });
      await wfRepo.insertTransition(tx, {
        nodeId: node.id, fromActivation: node.activation_state, toActivation: 'ELIGIBLE', fromExecution: node.execution_state, toExecution: 'RETURNED',
        actorUserId: actor.userId, reason: action === 'RETURN' ? 'APPROVAL_RETURNED' : 'APPROVAL_INFORMATION_REQUESTED', metadata: { reason }, at: ctx.now,
      });
      await createSubmitTask(tx, ctx, project, node, node.due_at, `Returned for correction: ${reason}`);
    }

    await audit(tx, ctx, {
      action: `approval.${action.toLowerCase()}`, entityType: 'approval_case', entityId: id, projectId: c.project_id, actorPositionId: positionId,
      oldData: { status: c.status }, newData: { status: newStatus, decision: action },
      metadata: { nodeCode: c.node_code, reason: reason ?? null, authorityRule: c.authority_rule_code, syntheticAuthority: c.authority_synthetic },
    });
    await emit(tx, ctx, {
      aggregateType: 'PROJECT', aggregateId: c.project_id, actorPositionId: positionId, eventType: 'ApprovalDecided',
      payload: {
        approvalCaseId: id, decision: action, approvalType: c.approval_type, nodeCode: c.node_code, projectCode: c.project_code,
        submittedBy: c.submitted_by, reason: reason ?? null, authorityRuleVersionId: c.authority_rule_version_id,
      },
    });
  });
  return getApproval(db, ctx, id);
}

/**
 * Human resolution of an unresolved authority (docs D-013). Requires authority.manual_assign; records who, why and when.
 * The engine never does this by itself.
 */
export async function manualAssignAuthority(db: Db, ctx: RequestContext, id: string, positionId: string, reason: string): Promise<ApprovalDto> {
  const actor = ctx.actor!;
  await withTx(db, async (tx) => {
    const pre = await loadVisibleCase(tx, actor, id);
    await projects.lockProject(tx, pre.project_id);
    await repo.lockCase(tx, id);
    const c = (await repo.getCase(tx, id))!;
    if (!['PENDING', 'RETURNED', 'IN_REVIEW'].includes(c.status)) throw conflict(`This approval is already ${c.status}.`);
    if (c.resolution_status === 'RESOLVED') throw conflict('Authority was already resolved from a verified rule; manual assignment is not needed.');
    const position = await getPositionBrief(tx, positionId);
    if (!position) throw validation('The selected position does not exist.', [{ field: 'positionId', message: 'Unknown position' }]);

    const prev = c.resolution_snapshot ?? {};
    const manual = { by: actor.displayName, byUserId: actor.userId, at: ctx.now.toISOString(), reason, positionId, positionCode: position.code };
    await authRepo.updateResolutionManual(tx, c.authority_resolution_id!, {
      positionId, userId: position.holder?.userId ?? null,
      snapshot: { ...prev, manualAssignments: [...(((prev as Record<string, unknown>).manualAssignments as unknown[]) ?? []), manual] }, at: ctx.now,
    });
    await wfRepo.updateNode(tx, c.workflow_node_instance_id, { assigned_position_id: positionId });
    await wfRepo.completeOpenTasks(tx, c.workflow_node_instance_id, ['MANUAL_AUTHORITY_REVIEW'], ctx.now);
    await audit(tx, ctx, {
      action: 'approval.manual_assigned', entityType: 'approval_case', entityId: id, projectId: c.project_id,
      oldData: { resolution: c.resolution_status }, newData: { resolution: 'MANUAL_REVIEW', positionCode: position.code }, metadata: { reason },
    });
    await emit(tx, ctx, {
      aggregateType: 'PROJECT', aggregateId: c.project_id, eventType: 'AuthorityManuallyAssigned',
      payload: { approvalCaseId: id, projectCode: c.project_code, nodeCode: c.node_code, positionId, positionCode: position.code, reason },
    });
  });
  return getApproval(db, ctx, id);
}
