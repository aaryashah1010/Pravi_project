import type { Queryable } from '../../platform/db.js';
import type { RequestContext } from '../../platform/context.js';
import { audit } from '../../platform/audit.js';
import { emit } from '../../platform/events.js';
import { findSeat, resolveAuthority } from '../authority/authority.service.js';
import type { ProjectRow } from '../projects/projects.repo.js';
import * as wfRepo from '../workflows/workflows.repo.js';
import { createTask } from '../workflows/task-factory.js';
import * as repo from './approvals.repo.js';

/** "Prepare and submit" task on the submitter seat configured on the node (falls back to the project creator). */
export async function createSubmitTask(tx: Queryable, ctx: RequestContext, project: ProjectRow, node: wfRepo.NodeRow, dueAt: Date | null, note?: string): Promise<void> {
  const submitterCode = (node.config.submitter_position_type as string | undefined) ?? null;
  const submitterTypeId = submitterCode ? await wfRepo.positionTypeIdByCode(tx, submitterCode) : null;
  const seat = submitterTypeId ? await findSeat(tx, project.owning_office_id, submitterTypeId) : null;
  await createTask(tx, ctx, {
    projectId: project.id,
    projectCode: project.project_code,
    nodeId: node.id,
    taskType: 'APPROVAL_SUBMIT',
    title: `Prepare and submit: ${node.name}`,
    description: note ?? 'Attach the required documents and submit this approval for decision.',
    assignedPositionId: seat?.positionId ?? null,
    assignedUserId: seat ? null : project.created_by,
    ruleVersionId: node.source_rule_version_id,
    dueAt,
    link: `/projects/${project.id}?tab=approvals`,
  });
}

/**
 * Called when an APPROVAL node becomes ELIGIBLE: opens the approval case, resolves the competent authority (never guessing),
 * and creates the "prepare and submit" task. If authority cannot be resolved, a manual-review task goes to an administrator
 * instead of assigning anyone automatically.
 */
export async function openApprovalCase(tx: Queryable, ctx: RequestContext, project: ProjectRow, node: wfRepo.NodeRow, dueAt: Date | null): Promise<string> {
  const decisionType = String(node.config.decision_type ?? '');
  const outcome = await resolveAuthority(tx, ctx, {
    projectId: project.id,
    decisionType,
    approvalType: decisionType,
    workflowNodeInstanceId: node.id,
  });
  const caseId = await repo.insertCase(tx, { projectId: project.id, nodeId: node.id, approvalType: decisionType, resolutionId: outcome.resolutionId, at: ctx.now });
  await wfRepo.updateNode(tx, node.id, { assigned_position_id: outcome.positionId });

  await audit(tx, ctx, {
    action: 'approval_case.opened',
    entityType: 'approval_case',
    entityId: caseId,
    projectId: project.id,
    newData: { approvalType: decisionType, resolution: outcome.status, authorityRule: outcome.authorityRuleCode },
    metadata: { nodeCode: node.node_code, reason: outcome.reason },
  });
  await emit(tx, ctx, {
    aggregateType: 'PROJECT',
    aggregateId: project.id,
    eventType: outcome.requiresManualReview ? 'AuthorityUnresolved' : 'ApprovalCaseOpened',
    payload: { approvalCaseId: caseId, approvalType: decisionType, resolution: outcome.status, nodeCode: node.node_code, projectCode: project.project_code },
  });

  await createSubmitTask(tx, ctx, project, node, dueAt);

  if (outcome.requiresManualReview) {
    const admin = await wfRepo.adminUserId(tx);
    await createTask(tx, ctx, {
      projectId: project.id,
      projectCode: project.project_code,
      nodeId: node.id,
      taskType: 'MANUAL_AUTHORITY_REVIEW',
      title: `Manual authority review: ${node.name}`,
      description: `${outcome.reason} No automatic assignment was made; an authorized administrator must assign the deciding position.`,
      priority: 'HIGH',
      assignedUserId: admin ?? project.created_by,
      dueAt,
      link: `/approvals/${caseId}`,
    });
  }
  return caseId;
}
