import type { Db } from '../../platform/db.js';
import { type RequestContext, can } from '../../platform/context.js';
import { AppError } from '../../platform/errors.js';
import { getProjectDetail } from '../projects/projects.service.js';
import { getWorkflow } from '../workflows/workflow-view.js';
import { getProjectBlockers } from '../workflows/blockers.service.js';
import { listApprovals } from '../approvals/approvals.service.js';
import { listIssues } from '../issues/issues.service.js';
import { getProvenance } from '../rules/rules.service.js';
import { listAudit } from '../audit/audit.service.js';
import type { AiContext } from './ai.types.js';

export interface BuiltContext {
  context: AiContext;
  /** ruleCode -> ids, kept server-side for citation persistence (never sent to the model). */
  ruleIds: Map<string, { ruleVersionId: string; sourceId: string; sourceCode: string }>;
}

const GATING = new Set(['BLOCKING', 'REQUIRES_COMPLETION']);

/**
 * Deterministic, permission-filtered context. Uses the same scoped services the UI uses, so the model can never see a project
 * the actor cannot see. Audit history is included only for users holding audit.read.
 */
export async function buildContext(db: Db, ctx: RequestContext, projectId: string): Promise<BuiltContext> {
  const actor = ctx.actor!;
  const now = ctx.now;
  const project = await getProjectDetail(db, actor, projectId); // 404 if not visible

  const wf = await getWorkflow(db, actor, projectId, now).catch((e) => {
    if (e instanceof AppError && e.code === 'NOT_FOUND') return null; // not submitted yet
    throw e;
  });
  const blockers = wf ? await getProjectBlockers(db, actor, projectId, now, wf) : null;
  const approvals = wf && (actor.permissions.has('approval.review') || actor.permissions.has('approval.decide')) ? await listApprovals(db, ctx, { projectId }) : [];
  const issues = await listIssues(db, actor, projectId, now, 'open');
  const audit = can(actor, 'audit.read') ? await listAudit(db, actor, { projectId, limit: 8 }) : [];

  const ruleIdsWanted = new Set<string>();
  for (const n of wf?.nodes ?? []) if (n.rule) ruleIdsWanted.add(n.rule.id);
  for (const a of approvals) if (a.authority.rule) ruleIdsWanted.add(a.authority.rule.id);

  const ruleIds: BuiltContext['ruleIds'] = new Map();
  const rules: AiContext['rules'] = [];
  for (const id of [...ruleIdsWanted].slice(0, 30)) {
    const p = await getProvenance(db, id);
    ruleIds.set(p.rule.ruleCode, { ruleVersionId: id, sourceId: p.rule.source.id, sourceCode: p.rule.source.code });
    rules.push({
      ruleCode: p.rule.ruleCode, name: p.rule.name, statement: p.rule.statement, trustBadge: p.rule.trustBadge, executable: p.rule.executable,
      synthetic: p.rule.synthetic, sourceCode: p.rule.source.code, sourceTitle: p.rule.source.title, citations: p.citations.map((c) => c.locator),
    });
  }

  const context: AiContext = {
    generatedAt: now.toISOString(),
    project: {
      code: project.code, name: project.name, stage: project.lifecycleStage, status: project.operationalStatus, estimatedCost: project.estimatedCost,
      department: project.departmentName, location: project.jurisdictionName,
    },
    workflowSummary: wf?.summary ?? { total: 0, completed: 0, eligible: 0, active: 0, blocked: 0, notApplicable: 0, pendingVerification: 0 },
    nodes: (wf?.nodes ?? []).map((n) => ({
      code: n.nodeCode, name: n.name, type: n.nodeType, state: n.activationState, gateKind: n.gateKind, ruleCode: n.rule?.ruleCode ?? null,
      owner: n.assignedPosition ? `${n.assignedPosition.designation}${n.assignedPosition.holder ? '' : ' (vacant seat)'}` : null,
      ageDays: n.ageDays, slaDays: n.slaDays, overdue: n.overdue, pendingFacts: n.conditionPending?.facts ?? [],
      missingDocuments: n.requiredDocuments.filter((d) => d.status === 'MISSING' || d.status === 'REJECTED').map((d) => d.name),
      openBlockingIssues: n.openIssueCount,
    })),
    gatingEdges: (wf?.edges ?? []).filter((e) => e.state === 'ACTIVE' && GATING.has(e.dependencyType)).map((e) => ({ from: e.from, to: e.to })),
    blockers: (blockers?.blockers ?? []).slice(0, 3),
    parallelEligible: (blockers?.parallelEligible ?? []).map((p) => ({ nodeCode: p.nodeCode, name: p.name })),
    approvals: approvals.map((a) => ({
      nodeCode: a.nodeCode, type: a.approvalType, status: a.status, decidingPosition: a.authority.position ? `${a.authority.position.designation}, ${a.authority.position.officeName}` : null,
      resolution: a.authority.resolutionStatus, syntheticAuthority: a.authority.synthetic,
    })),
    openIssues: issues.map((i) => ({ title: i.title, severity: i.severity, category: i.category, ageDays: i.ageDays, blocks: i.blocks.map((b) => b.nodeCode) })),
    rules,
    recentActivity: audit.map((a) => ({ action: a.action, at: a.at, actor: a.actorName })),
  };
  return { context, ruleIds };
}
