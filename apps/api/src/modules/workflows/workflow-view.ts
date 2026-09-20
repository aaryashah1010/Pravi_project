// Read model for the workflow graph. Composes several repos on purpose (pure read; no mutations).
import type { GateKind, WorkflowDto, WorkflowNodeDto } from '@infraflow/shared';
import type { Queryable } from '../../platform/db.js';
import type { Actor } from '../../platform/context.js';
import { notFound } from '../../platform/errors.js';
import * as projects from '../projects/projects.repo.js';
import * as rulesRepo from '../rules/rules.repo.js';
import { toRuleDto } from '../rules/rules.service.js';
import { isExecutable } from '../rules/domain/rule-status.js';
import * as repo from './workflows.repo.js';

const DAY = 86_400_000;

export function gateKindOf(n: Pick<repo.NodeRow, 'activation_state' | 'blocking_reason' | 'source_rule_version_id'>, ruleExecutable: boolean | null): GateKind {
  if (n.activation_state === 'NOT_APPLICABLE') return 'NOT_APPLICABLE';
  if (n.blocking_reason?.type === 'CONDITION_UNKNOWN') return 'CONDITIONAL_PENDING';
  if (!n.source_rule_version_id) return 'CONFIGURED';
  return ruleExecutable ? 'RULE_BACKED' : 'ADVISORY';
}

export async function getWorkflow(db: Queryable, actor: Actor, projectId: string, now: Date = new Date()): Promise<WorkflowDto> {
  const project = await projects.getProject(db, projectId, actor);
  if (!project) throw notFound('Project');
  const instance = await repo.getInstance(db, projectId);
  if (!instance) throw notFound('Workflow (the project has not been submitted yet)');

  const [nodes, deps] = await Promise.all([repo.loadNodes(db, instance.id), repo.loadDeps(db, instance.id)]);
  const nodeIds = nodes.map((n) => n.id);
  const ruleIds = [...new Set(nodes.map((n) => n.source_rule_version_id).filter((x): x is string => !!x))];
  const positionIds = [...new Set(nodes.map((n) => n.assigned_position_id).filter((x): x is string => !!x))];

  const [rules, seats, cases, docs, issues] = await Promise.all([
    rulesRepo.getRulesByIds(db, ruleIds),
    positionIds.length
      ? db.query<{ id: string; position_code: string; designation: string; office_name: string; user_id: string | null; display_name: string | null }>(
          `SELECT p.id, p.position_code, pt.designation, o.name AS office_name, h.user_id, h.display_name
             FROM positions p JOIN position_types pt ON pt.id = p.position_type_id JOIN offices o ON o.id = p.office_id
             LEFT JOIN v_current_position_holders h ON h.position_id = p.id AND h.assignment_type = 'PRIMARY'
            WHERE p.id = ANY($1::uuid[])`,
          [positionIds],
        )
      : Promise.resolve({ rows: [] as never[] }),
    db.query<{ workflow_node_instance_id: string; id: string; approval_type: string; status: string; resolution_status: string | null; synthetic: boolean }>(
      `SELECT ac.workflow_node_instance_id, ac.id, ac.approval_type, ac.status, res.resolution_status,
              COALESCE(rv.scope->>'synthetic','false') = 'true' AS synthetic
         FROM approval_cases ac
         LEFT JOIN authority_resolutions res ON res.id = ac.authority_resolution_id
         LEFT JOIN authority_rules rl ON rl.id = res.authority_rule_id
         LEFT JOIN rule_versions rv ON rv.id = rl.rule_version_id
        WHERE ac.workflow_node_instance_id = ANY($1::uuid[])`,
      [nodeIds],
    ),
    db.query<{ workflow_node_instance_id: string; code: string; name: string; status: string }>(
      `SELECT prd.workflow_node_instance_id, dt.code, dt.name, prd.status
         FROM project_required_documents prd JOIN document_types dt ON dt.id = prd.document_type_id
        WHERE prd.workflow_node_instance_id = ANY($1::uuid[]) ORDER BY dt.code`,
      [nodeIds],
    ),
    db.query<{ workflow_node_instance_id: string; c: number }>(
      `SELECT iwl.workflow_node_instance_id, count(*)::int AS c
         FROM issue_workflow_links iwl JOIN issues i ON i.id = iwl.issue_id
        WHERE iwl.workflow_node_instance_id = ANY($1::uuid[]) AND iwl.impact_type = 'BLOCKS' AND i.status IN ('OPEN','IN_PROGRESS','BLOCKED')
        GROUP BY 1`,
      [nodeIds],
    ),
  ]);

  const ruleById = new Map(rules.map((r) => [r.id, r]));
  const seatById = new Map(seats.rows.map((s) => [s.id, s]));
  const caseByNode = new Map(cases.rows.map((c) => [c.workflow_node_instance_id, c]));
  const issueByNode = new Map(issues.rows.map((i) => [i.workflow_node_instance_id, i.c]));
  const codeById = new Map(nodes.map((n) => [n.id, n.node_code]));

  const nodeDtos: WorkflowNodeDto[] = nodes.map((n) => {
    const rule = n.source_rule_version_id ? ruleById.get(n.source_rule_version_id) : undefined;
    const executable = rule ? isExecutable(rule, now) : null;
    const seat = n.assigned_position_id ? seatById.get(n.assigned_position_id) : undefined;
    const c = caseByNode.get(n.id);
    const done = n.activation_state === 'COMPLETED' || n.activation_state === 'NOT_APPLICABLE';
    const since = n.eligible_at;
    const live = !done && ['ELIGIBLE', 'ACTIVE', 'BLOCKED'].includes(n.activation_state);
    const ruleDto = rule ? toRuleDto(rule, now) : null;
    return {
      id: n.id,
      nodeCode: n.node_code,
      name: n.name,
      nodeType: n.node_type,
      activationState: n.activation_state,
      executionState: n.execution_state,
      gateKind: gateKindOf(n, executable),
      conditionPending: n.blocking_reason?.type === 'CONDITION_UNKNOWN' ? { facts: n.blocking_reason.facts ?? [], message: n.blocking_reason.message ?? '' } : null,
      slaDays: n.sla_days,
      eligibleAt: n.eligible_at?.toISOString() ?? null,
      dueAt: n.due_at?.toISOString() ?? null,
      ageDays: live && since ? Math.max(0, Math.floor((now.getTime() - since.getTime()) / DAY)) : null,
      overdue: live && !!n.due_at && n.due_at.getTime() < now.getTime(),
      completedAt: n.completed_at?.toISOString() ?? null,
      assignedPosition: seat
        ? { id: seat.id, code: seat.position_code, designation: seat.designation, officeName: seat.office_name,
            holder: seat.user_id ? { userId: seat.user_id, displayName: seat.display_name! } : null }
        : null,
      rule: ruleDto ? { id: ruleDto.id, ruleCode: ruleDto.ruleCode, name: ruleDto.name, trustBadge: ruleDto.trustBadge, statement: ruleDto.statement } : null,
      approval: c
        ? { id: c.id, approvalType: c.approval_type, status: c.status, resolutionStatus: c.resolution_status, requiresManualReview: c.resolution_status !== 'RESOLVED', syntheticAuthority: c.synthetic }
        : null,
      requiredDocuments: docs.rows.filter((d) => d.workflow_node_instance_id === n.id).map((d) => ({ documentTypeCode: d.code, name: d.name, status: d.status })),
      openIssueCount: issueByNode.get(n.id) ?? 0,
    };
  });

  const count = (f: (n: WorkflowNodeDto) => boolean) => nodeDtos.filter(f).length;
  return {
    instanceId: instance.id,
    projectId,
    state: instance.state,
    templateCode: instance.template_code,
    templateVersion: instance.template_version_no,
    generatedAt: instance.generated_at.toISOString(),
    nodes: nodeDtos,
    edges: deps.map((d) => ({
      id: d.id,
      from: codeById.get(d.from_node_instance_id)!,
      to: codeById.get(d.to_node_instance_id)!,
      dependencyType: d.dependency_type,
      originalType: String((d.condition as { original_type?: string })?.original_type ?? d.dependency_type),
      state: d.state,
    })),
    summary: {
      total: nodeDtos.length,
      completed: count((n) => n.activationState === 'COMPLETED'),
      eligible: count((n) => n.activationState === 'ELIGIBLE'),
      active: count((n) => n.activationState === 'ACTIVE'),
      blocked: count((n) => n.activationState === 'BLOCKED'),
      notApplicable: count((n) => n.activationState === 'NOT_APPLICABLE'),
      pendingVerification: count((n) => n.gateKind === 'CONDITIONAL_PENDING'),
    },
  };
}

