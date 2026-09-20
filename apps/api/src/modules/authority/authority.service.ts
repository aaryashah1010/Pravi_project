import type { Queryable } from '../../platform/db.js';
import type { RequestContext } from '../../platform/context.js';
import { safeEvaluate } from '../rules/domain/condition.js';
import { buildFacts } from '../projects/facts.js';
import * as projects from '../projects/projects.repo.js';
import * as repo from './authority.repo.js';
import { type AuthorityCandidate, type HolderDecision, type OfficeLevel, decideHolder, selectAuthorityRule } from './domain/decide.js';

export interface AuthorityOutcome {
  resolutionId: string;
  status: 'RESOLVED' | 'UNRESOLVED' | 'AMBIGUOUS' | 'NO_RULE' | 'INACTIVE_POSITION' | 'MANUAL_REVIEW';
  requiresManualReview: boolean;
  positionId: string | null;
  userId: string | null;
  authorityRuleCode: string | null;
  authorityRuleVersionId: string | null;
  synthetic: boolean;
  reason: string;
}

/** Copy shown to users; wording follows docs/product/ui-copy.md (no automatic assignment when unresolved). */
export const UNRESOLVED_MESSAGE =
  'The system could not resolve a verified competent authority for this project state. No automatic assignment was made.';

const REASONS: Record<string, string> = {
  NO_RULE: 'No verified authority rule is configured for this decision, department and project value.',
  AMBIGUOUS: 'More than one equally applicable authority (rule or position) was found, so none was chosen.',
  CONDITION_UNKNOWN: 'An authority rule depends on a project fact that is not recorded.',
  INACTIVE_POSITION: 'The competent position exists but currently has no active holder.',
  UNRESOLVED: 'No position of the required type exists within the project scope.',
};

export interface SeatLookup {
  positionId: string;
  positionCode: string;
  candidateCount: number;
  holder: { userId: string; displayName: string } | null;
}

/**
 * Nearest seat of a position type, walking up from the owning office. Used for ordinary work items (not approvals):
 * tasks are assigned to the SEAT; the person is resolved at read time, so a transfer never orphans a task.
 */
export async function findSeat(tx: Queryable, owningOfficeId: string, positionTypeId: string): Promise<SeatLookup | null> {
  const levels = await repo.levelsByOwningOffice(tx, owningOfficeId, positionTypeId);
  const level = levels.find((l) => l.seats.length > 0);
  if (!level) return null;
  const seat = level.seats[0]!;
  const holder = seat.holders.find((h) => h.assignmentType === 'PRIMARY') ?? seat.holders[0] ?? null;
  return {
    positionId: seat.positionId,
    positionCode: seat.positionCode,
    candidateCount: level.seats.length,
    holder: holder ? { userId: holder.userId, displayName: holder.displayName } : null,
  };
}

const toCandidate = (r: repo.CandidateRow, facts: ReturnType<typeof buildFacts>): AuthorityCandidate => ({
  id: r.id,
  code: r.code,
  requiredPositionTypeId: r.required_position_type_id,
  routingScope: r.routing_scope,
  priority: r.priority,
  hasDepartment: r.has_department,
  hasProjectType: r.has_project_type,
  hasJurisdictionType: r.has_jurisdiction_type,
  hasCostBand: r.has_cost_band,
  hasConditions: Object.keys(r.conditions ?? {}).length > 0,
  conditionsResult: safeEvaluate(r.conditions, facts).result,
  ruleVersionId: r.rule_version_id,
  ruleCode: r.rule_code,
  rule: {
    enforcement_mode: r.enforcement_mode,
    verification_status: r.verification_status,
    effective_from: r.effective_from,
    effective_to: r.effective_to,
    scope: r.scope,
    conditions: r.rv_conditions,
    action: r.action,
  },
});

/**
 * Resolve who may decide `decisionType` for a project. Persists an authority_resolutions row (with a full snapshot)
 * inside the caller's transaction. Never guesses: any doubt yields a non-RESOLVED status that routes to manual review.
 */
export async function resolveAuthority(
  tx: Queryable,
  ctx: RequestContext,
  input: { projectId: string; decisionType: string; approvalType: string; workflowNodeInstanceId: string | null },
): Promise<AuthorityOutcome> {
  const { project, site, jurisdictionChain } = await projects.loadFactRows(tx, input.projectId);
  if (!project) throw new Error(`Project ${input.projectId} not found for authority resolution`);
  const facts = buildFacts(project, site, jurisdictionChain);
  const today = ctx.now.toISOString().slice(0, 10);

  const rows = await repo.listCandidates(tx, {
    departmentId: project.department_organization_id,
    projectTypeId: project.project_type_id,
    cost: project.estimated_cost,
    jurisdictionType: project.jurisdiction_type,
    decisionType: input.decisionType,
    today,
  });
  const selection = selectAuthorityRule(rows.map((r) => toCandidate(r, facts)), ctx.now);

  let status: AuthorityOutcome['status'];
  let reason: string;
  let decision: HolderDecision | null = null;
  let levels: OfficeLevel[] = [];
  let selected: AuthorityCandidate | null = null;

  if (selection.status === 'SELECTED') {
    selected = selection.candidate;
    if (selected.routingScope === 'OWNING_OFFICE') {
      levels = await repo.levelsByOwningOffice(tx, project.owning_office_id, selected.requiredPositionTypeId);
    } else if (selected.routingScope === 'PROJECT_JURISDICTION' && project.primary_jurisdiction_id) {
      levels = await repo.levelsByJurisdiction(tx, project.primary_jurisdiction_id, project.department_organization_id, selected.requiredPositionTypeId);
    }
    decision = decideHolder(levels);
    if (decision.status === 'RESOLVED') {
      status = 'RESOLVED';
      reason = 'Resolved from a verified authority rule to the current holder of the competent position.';
    } else {
      status = decision.status === 'INACTIVE_POSITION' ? 'INACTIVE_POSITION' : decision.status === 'AMBIGUOUS' ? 'AMBIGUOUS' : 'UNRESOLVED';
      reason = REASONS[status]!;
    }
  } else if (selection.status === 'NO_RULE') {
    status = 'NO_RULE';
    reason = REASONS.NO_RULE!;
  } else if (selection.status === 'AMBIGUOUS') {
    status = 'AMBIGUOUS';
    reason = REASONS.AMBIGUOUS!;
  } else {
    status = 'MANUAL_REVIEW';
    reason = REASONS.CONDITION_UNKNOWN!;
  }

  const holder = decision?.status === 'RESOLVED' ? decision : null;
  const synthetic = selected?.rule.scope?.synthetic === true;
  const snapshot = {
    decisionType: input.decisionType,
    projectCost: project.estimated_cost,
    department: project.department_code,
    at: ctx.now.toISOString(),
    reason,
    considered: selection.considered,
    selectedRule: selected ? { code: selected.code, ruleCode: selected.ruleCode, ruleVersionId: selected.ruleVersionId, synthetic } : null,
    routingScope: selected?.routingScope ?? null,
    levels: levels.map((l) => ({
      office: l.officeName,
      seats: l.seats.map((s) => ({ positionCode: s.positionCode, holders: s.holders.map((h) => ({ userId: h.userId, name: h.displayName, type: h.assignmentType })) })),
    })),
    holder: holder ? { positionId: holder.positionId, userId: holder.userId } : null,
  };

  const resolutionId = await repo.insertResolution(tx, {
    projectId: input.projectId,
    workflowNodeInstanceId: input.workflowNodeInstanceId,
    approvalType: input.approvalType,
    authorityRuleId: selected?.id ?? null,
    requiredPositionTypeId: selected?.requiredPositionTypeId ?? null,
    resolvedPositionId: holder?.positionId ?? (decision?.status === 'INACTIVE_POSITION' ? decision.positionId : null),
    resolvedUserId: holder?.userId ?? null,
    status,
    candidateCount: rows.length,
    snapshot,
    at: ctx.now,
  });

  return {
    resolutionId,
    status,
    requiresManualReview: status !== 'RESOLVED',
    positionId: holder?.positionId ?? null,
    userId: holder?.userId ?? null,
    authorityRuleCode: selected?.code ?? null,
    authorityRuleVersionId: selected?.ruleVersionId ?? null,
    synthetic,
    reason,
  };
}
