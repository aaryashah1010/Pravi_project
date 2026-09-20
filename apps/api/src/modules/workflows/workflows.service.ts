import type { Queryable } from '../../platform/db.js';
import type { RequestContext } from '../../platform/context.js';
import { audit } from '../../platform/audit.js';
import { emit } from '../../platform/events.js';
import { conflict, ruleNotVerified } from '../../platform/errors.js';
import * as projects from '../projects/projects.repo.js';
import { buildFacts } from '../projects/facts.js';
import * as rulesRepo from '../rules/rules.repo.js';
import { safeEvaluate } from '../rules/domain/condition.js';
import { isExecutable } from '../rules/domain/rule-status.js';
import { findSeat } from '../authority/authority.service.js';
import { openApprovalCase } from '../approvals/approvals.activation.js';
import * as repo from './workflows.repo.js';
import { createTask } from './task-factory.js';
import { type RuleIn, planWorkflow } from './domain/generator.js';
import { type DepState, type NodeState, nodesReadyToActivate } from './domain/readiness.js';

const STAGE_ORDER = [
  'IDENTIFICATION', 'PROPOSAL', 'SITE_READINESS', 'FUNDING', 'ADMINISTRATIVE_APPROVAL', 'DESIGN', 'TECHNICAL_SANCTION', 'CLEARANCES',
  'PROCUREMENT', 'AWARD', 'CONTRACT', 'WORK_ORDER', 'CONSTRUCTION', 'INSPECTION', 'BILLING', 'COMPLETION', 'HANDOVER', 'DLP', 'CLOSED',
];

export const addDays = (d: Date, days: number): Date => new Date(d.getTime() + days * 86_400_000);

const toNodeState = (n: repo.NodeRow): NodeState => ({
  code: n.node_code,
  nodeType: n.node_type,
  activation: n.activation_state,
  execution: n.execution_state,
  conditionPending: n.blocking_reason?.type === 'CONDITION_UNKNOWN',
});

/**
 * Generate the workflow instance for a project from the active template + verified rule versions.
 * Records every rule evaluation, freezes the template/rule versions used (historical reproducibility), then recomputes.
 */
export async function generateWorkflow(tx: Queryable, ctx: RequestContext, projectId: string): Promise<{ instanceId: string; nodeCount: number }> {
  await projects.lockProject(tx, projectId);
  const { project, site, jurisdictionChain } = await projects.loadFactRows(tx, projectId);
  if (!project) throw new Error(`Project ${projectId} not found`);
  if (await repo.getInstance(tx, projectId)) throw conflict('A workflow has already been generated for this project.');

  const today = ctx.now.toISOString().slice(0, 10);
  const template = await repo.findTemplate(tx, project.project_type_id, project.department_organization_id, today);
  if (!template) throw ruleNotVerified('No active, verified workflow template is configured for this project type and department.');

  const [tNodes, tEdges] = await Promise.all([repo.loadTemplateNodes(tx, template.id), repo.loadTemplateEdges(tx, template.id)]);
  const ruleIds = [...new Set(tNodes.map((n) => n.rule_version_id).filter((x): x is string => !!x))];
  const ruleRows = await rulesRepo.getRulesByIds(tx, ruleIds);
  const rules = new Map<string, RuleIn>(
    ruleRows.map((r) => [r.id, {
      id: r.id, rule_code: r.rule_code, enforcement_mode: r.enforcement_mode, verification_status: r.verification_status,
      effective_from: r.effective_from, effective_to: r.effective_to, scope: r.scope, conditions: r.conditions, action: r.action,
    }]),
  );
  const facts = buildFacts(project, site, jurisdictionChain);
  const plan = planWorkflow({ nodes: tNodes, edges: tEdges, rules, facts, at: ctx.now });

  const instanceId = await repo.insertInstance(tx, {
    projectId,
    templateId: template.id,
    versionNo: template.version_no,
    at: ctx.now,
    snapshot: {
      templateCode: template.code,
      templateVersion: template.version_no,
      generatedAt: ctx.now.toISOString(),
      facts,
      ruleVersions: ruleRows.map((r) => ({ ruleVersionId: r.id, ruleCode: r.rule_code, versionNo: r.version_no, executable: isExecutable(r, ctx.now) })),
    },
  });

  const idByCode = new Map<string, string>();
  for (const n of plan.nodes) {
    const id = await repo.insertNodeInstance(tx, {
      instanceId,
      nodeTemplateId: n.templateNodeId,
      nodeCode: n.nodeCode,
      nodeType: n.nodeType,
      activationState: n.activationState,
      positionTypeId: n.assignedPositionTypeId,
      ruleVersionId: n.sourceRuleVersionId,
      blockingReason: n.blockingReason,
      slaDays: n.slaDays,
      at: ctx.now,
    });
    idByCode.set(n.nodeCode, id);
    if (n.activationState !== 'NOT_APPLICABLE') await repo.insertRequiredDocs(tx, projectId, id, n.templateNodeId, n.sourceRuleVersionId);
    await repo.insertTransition(tx, {
      nodeId: id, fromActivation: null, toActivation: n.activationState, fromExecution: null, toExecution: 'PENDING',
      actorUserId: ctx.actor?.userId ?? null, reason: 'WORKFLOW_GENERATED', metadata: { gateKind: n.gateKind }, at: ctx.now,
    });
  }
  for (const d of plan.dependencies) {
    await repo.insertDependency(tx, {
      instanceId, fromId: idByCode.get(d.fromNodeCode)!, toId: idByCode.get(d.toNodeCode)!, type: d.dependencyType,
      condition: { ...d.condition, original_type: d.originalType }, state: d.state, at: ctx.now,
    });
  }
  for (const e of plan.evaluations) {
    await repo.insertRuleEvaluation(tx, {
      projectId, ruleVersionId: e.ruleVersionId, context: { nodeCode: e.nodeCode, projectCost: project.estimated_cost }, result: e.result,
      explanation: e.explanation, userId: ctx.actor?.userId ?? null, at: ctx.now,
    });
  }

  await audit(tx, ctx, {
    action: 'workflow.generated', entityType: 'workflow_instance', entityId: instanceId, projectId,
    newData: { templateCode: template.code, templateVersion: template.version_no, nodes: plan.nodes.length },
    metadata: {
      notApplicable: plan.nodes.filter((n) => n.gateKind === 'NOT_APPLICABLE').map((n) => n.nodeCode),
      pendingVerification: plan.nodes.filter((n) => n.gateKind === 'CONDITIONAL_PENDING').map((n) => n.nodeCode),
    },
  });
  await emit(tx, ctx, {
    aggregateType: 'PROJECT', aggregateId: projectId, eventType: 'WorkflowGenerated',
    payload: { projectCode: project.project_code, instanceId, templateCode: template.code, templateVersion: template.version_no, nodeCount: plan.nodes.length },
  });

  await recompute(tx, ctx, projectId);
  return { instanceId, nodeCount: plan.nodes.length };
}

/** Move a node to COMPLETED (caller has already checked authority/guards) and let the graph react. */
export async function completeNode(tx: Queryable, ctx: RequestContext, nodeId: string, reason: string, metadata: Record<string, unknown> = {}): Promise<void> {
  const node = await repo.getNode(tx, nodeId);
  if (!node) throw new Error(`Node ${nodeId} not found`);
  await projects.lockProject(tx, node.project_id);
  await repo.updateNode(tx, nodeId, { activation_state: 'COMPLETED', execution_state: 'COMPLETED', completed_at: ctx.now });
  await repo.insertTransition(tx, {
    nodeId, fromActivation: node.activation_state, toActivation: 'COMPLETED', fromExecution: node.execution_state, toExecution: 'COMPLETED',
    actorUserId: ctx.actor?.userId ?? null, reason, metadata, at: ctx.now,
  });
  await repo.satisfyOutgoing(tx, nodeId);
  await repo.completeOpenTasks(tx, nodeId, null, ctx.now);
  await recompute(tx, ctx, node.project_id);
}

async function activateNode(tx: Queryable, ctx: RequestContext, project: projects.ProjectRow, node: repo.NodeRow): Promise<void> {
  const dueAt = node.sla_days != null ? addDays(ctx.now, node.sla_days) : null;
  const seat = node.node_type !== 'APPROVAL' && node.assigned_position_type_id ? await findSeat(tx, project.owning_office_id, node.assigned_position_type_id) : null;

  await repo.updateNode(tx, node.id, {
    activation_state: 'ELIGIBLE', eligible_at: ctx.now, due_at: dueAt, assigned_position_id: seat ? seat.positionId : undefined,
  });
  await repo.insertTransition(tx, {
    nodeId: node.id, fromActivation: 'INACTIVE', toActivation: 'ELIGIBLE', fromExecution: node.execution_state, toExecution: node.execution_state,
    actorUserId: ctx.actor?.userId ?? null, reason: 'PREDECESSORS_SATISFIED', at: ctx.now,
  });

  const stage = node.config.lifecycle_stage as string | undefined;
  switch (node.node_type) {
    case 'APPROVAL':
      await openApprovalCase(tx, ctx, project, node, dueAt);
      break;
    case 'GATE':
      if (node.config.auto_complete) {
        await repo.updateNode(tx, node.id, { activation_state: 'COMPLETED', execution_state: 'COMPLETED', completed_at: ctx.now });
        await repo.insertTransition(tx, {
          nodeId: node.id, fromActivation: 'ELIGIBLE', toActivation: 'COMPLETED', fromExecution: node.execution_state, toExecution: 'COMPLETED',
          actorUserId: ctx.actor?.userId ?? null, reason: 'GATE_AUTO_COMPLETE', metadata: { note: 'All gating predecessors are satisfied.' }, at: ctx.now,
        });
        await repo.satisfyOutgoing(tx, node.id);
      }
      break;
    case 'INFORMATION':
      break;
    case 'MILESTONE': {
      const code = String(node.config.milestone_code ?? node.node_code);
      const seq = Number(code.replace(/\D/g, '')) || null;
      await repo.ensureMilestone(tx, project.id, { code, name: String(node.config.milestone_name ?? node.name), seq, at: ctx.now });
      await createTask(tx, ctx, {
        projectId: project.id, projectCode: project.project_code, nodeId: node.id, taskType: 'MILESTONE_UPDATE',
        title: `Verify progress: ${node.config.milestone_name ?? node.name}`,
        description: 'Record inspected progress for this milestone; contractor-reported progress is not treated as verified.',
        assignedPositionId: seat?.positionId ?? null, assignedUserId: seat ? null : project.created_by, ruleVersionId: node.source_rule_version_id,
        dueAt, link: `/projects/${project.id}?tab=construction`,
      });
      break;
    }
    default: {
      if (node.node_type === 'CLEARANCE') {
        await repo.ensureClearance(tx, project.id, node.id, String(node.config.clearance_type ?? node.node_code), node.source_rule_version_id, ctx.now);
      }
      await createTask(tx, ctx, {
        projectId: project.id, projectCode: project.project_code, nodeId: node.id, taskType: 'WORK_ITEM', title: node.name,
        description: stage ? `Stage: ${stage.replace(/_/g, ' ').toLowerCase()}` : null,
        assignedPositionId: seat?.positionId ?? null, assignedUserId: seat ? null : project.created_by, ruleVersionId: node.source_rule_version_id,
        dueAt, link: `/projects/${project.id}?tab=workflow`,
      });
    }
  }
}

async function ensureConditionTasks(tx: Queryable, ctx: RequestContext, project: projects.ProjectRow, nodes: repo.NodeRow[]): Promise<void> {
  for (const n of nodes) {
    if (n.activation_state !== 'INACTIVE' || n.blocking_reason?.type !== 'CONDITION_UNKNOWN') continue;
    if (await repo.hasOpenTask(tx, n.id, 'CONDITION_VERIFICATION')) continue;
    const seat = n.assigned_position_type_id ? await findSeat(tx, project.owning_office_id, n.assigned_position_type_id) : null;
    await createTask(tx, ctx, {
      projectId: project.id, projectCode: project.project_code, nodeId: n.id, taskType: 'CONDITION_VERIFICATION',
      title: `Confirm applicability: ${n.name}`,
      description: `${n.blocking_reason.message ?? ''} Record the missing project fact(s) in the project details to resolve this.`.trim(),
      priority: 'HIGH', assignedPositionId: seat?.positionId ?? null, assignedUserId: seat ? null : project.created_by,
      ruleVersionId: n.source_rule_version_id, link: `/projects/${project.id}?tab=overview`,
    });
  }
}

/**
 * Issues gate the graph: a live node with an open BLOCKS issue becomes BLOCKED (remembering its prior state);
 * when the last blocking issue is resolved it is restored. Idempotent.
 */
async function applyIssueBlocks(tx: Queryable, ctx: RequestContext, project: projects.ProjectRow, instance: repo.InstanceRow, nodes: repo.NodeRow[]): Promise<void> {
  const open = await repo.openBlockingIssues(tx, instance.id);
  for (const n of nodes) {
    const b = open.get(n.id);
    const milestoneCode = n.node_type === 'MILESTONE' ? String(n.config.milestone_code ?? n.node_code) : null;
    if (b && (n.activation_state === 'ELIGIBLE' || n.activation_state === 'ACTIVE')) {
      await repo.updateNode(tx, n.id, {
        activation_state: 'BLOCKED',
        blocking_reason: { type: 'ISSUE_BLOCKS', previousActivation: n.activation_state, issueIds: b.ids, message: `Blocked by open issue: ${b.title}` },
      });
      await repo.insertTransition(tx, {
        nodeId: n.id, fromActivation: n.activation_state, toActivation: 'BLOCKED', fromExecution: n.execution_state, toExecution: n.execution_state,
        actorUserId: ctx.actor?.userId ?? null, reason: 'ISSUE_BLOCKS', metadata: { issueIds: b.ids }, at: ctx.now,
      });
      if (milestoneCode) await repo.setMilestoneStatusByCode(tx, project.id, milestoneCode, 'BLOCKED', ctx.now);
    } else if (!b && n.activation_state === 'BLOCKED' && n.blocking_reason?.type === 'ISSUE_BLOCKS') {
      const prev = n.blocking_reason.previousActivation ?? 'ELIGIBLE';
      await repo.updateNode(tx, n.id, { activation_state: prev, blocking_reason: null });
      await repo.insertTransition(tx, {
        nodeId: n.id, fromActivation: 'BLOCKED', toActivation: prev, fromExecution: n.execution_state, toExecution: n.execution_state,
        actorUserId: ctx.actor?.userId ?? null, reason: 'ISSUE_RESOLVED', at: ctx.now,
      });
      if (milestoneCode) await repo.setMilestoneStatusByCode(tx, project.id, milestoneCode, 'IN_PROGRESS', ctx.now);
    }
  }
}

async function syncProjectState(tx: Queryable, ctx: RequestContext, project: projects.ProjectRow, instance: repo.InstanceRow, nodes: repo.NodeRow[]): Promise<void> {
  const live = nodes.filter((n) => ['ELIGIBLE', 'ACTIVE', 'BLOCKED'].includes(n.activation_state));
  let stage = project.lifecycle_stage;
  const stageIdx = (s: string) => STAGE_ORDER.indexOf(s);
  const liveStages = live.map((n) => n.config.lifecycle_stage as string | undefined).filter((s): s is string => !!s && stageIdx(s) >= 0);
  if (liveStages.length) stage = liveStages.reduce((a, b) => (stageIdx(b) > stageIdx(a) ? b : a));
  else if (project.lifecycle_stage === 'IDENTIFICATION') stage = 'PROPOSAL';

  let status = project.operational_status;
  if (['ACTIVE', 'AT_RISK', 'BLOCKED'].includes(status)) {
    if (live.some((n) => n.activation_state === 'BLOCKED')) status = 'BLOCKED';
    else if (live.some((n) => n.due_at && n.due_at.getTime() < ctx.now.getTime())) status = 'AT_RISK';
    else status = 'ACTIVE';
  }
  if (stage !== project.lifecycle_stage || status !== project.operational_status) {
    await projects.setProjectState(tx, project.id, { lifecycleStage: stage, operationalStatus: status }, ctx.now);
  }
  const allDone = nodes.every((n) => n.activation_state === 'COMPLETED' || n.activation_state === 'NOT_APPLICABLE' || n.activation_state === 'SKIPPED');
  const target = allDone ? 'COMPLETED' : 'ACTIVE';
  if (instance.state !== target && ['ACTIVE', 'COMPLETED'].includes(instance.state)) await repo.setInstanceState(tx, instance.id, target, ctx.now);
}

/**
 * Propagate readiness through the graph: activate every node whose gating predecessors are satisfied, spawn its
 * task / approval case, auto-complete gates, raise verification tasks for unknown facts, then sync project state.
 * Idempotent: running it twice creates nothing new.
 */
export async function recompute(tx: Queryable, ctx: RequestContext, projectId: string): Promise<{ activated: string[] }> {
  await projects.lockProject(tx, projectId);
  const project = await projects.getProject(tx, projectId);
  const instance = project ? await repo.getInstance(tx, projectId) : null;
  if (!project || !instance) return { activated: [] };

  const activated: string[] = [];
  for (let i = 0; i < 60; i++) {
    const nodes = await repo.loadNodes(tx, instance.id);
    const deps = await repo.loadDeps(tx, instance.id);
    const codeById = new Map(nodes.map((n) => [n.id, n.node_code]));
    const depStates: DepState[] = deps.map((d) => ({ from: codeById.get(d.from_node_instance_id)!, to: codeById.get(d.to_node_instance_id)!, type: d.dependency_type, state: d.state }));
    const ready = nodesReadyToActivate(nodes.map(toNodeState), depStates);
    if (!ready.length) break;
    for (const code of ready) {
      await activateNode(tx, ctx, project, nodes.find((n) => n.node_code === code)!);
      activated.push(code);
    }
  }

  let finalNodes = await repo.loadNodes(tx, instance.id);
  await ensureConditionTasks(tx, ctx, project, finalNodes);
  await applyIssueBlocks(tx, ctx, project, instance, finalNodes);
  finalNodes = await repo.loadNodes(tx, instance.id);
  const freshProject = (await projects.getProject(tx, projectId))!;
  await syncProjectState(tx, ctx, freshProject, instance, finalNodes);
  return { activated };
}

/**
 * After project facts change, resolve nodes that were waiting on a missing fact:
 *   MATCH -> node applies (its conditional edges start gating); NO_MATCH -> not applicable (edges disabled).
 * Only pending nodes are touched; already-decided nodes never silently change.
 */
export async function reevaluateConditions(tx: Queryable, ctx: RequestContext, projectId: string): Promise<{ resolved: string[] }> {
  await projects.lockProject(tx, projectId);
  const { project, site, jurisdictionChain } = await projects.loadFactRows(tx, projectId);
  const instance = project ? await repo.getInstance(tx, projectId) : null;
  if (!project || !instance) return { resolved: [] };
  const facts = buildFacts(project, site, jurisdictionChain);
  const nodes = await repo.loadNodes(tx, instance.id);
  const deps = await repo.loadDeps(tx, instance.id);
  const resolved: string[] = [];

  for (const n of nodes) {
    if (n.activation_state !== 'INACTIVE' || n.blocking_reason?.type !== 'CONDITION_UNKNOWN') continue;
    const ev = safeEvaluate(n.activation_condition, facts);
    if (ev.result === 'INDETERMINATE') continue;
    if (ev.result === 'NO_MATCH') {
      await repo.updateNode(tx, n.id, { activation_state: 'NOT_APPLICABLE', blocking_reason: null });
      for (const d of deps.filter((x) => x.from_node_instance_id === n.id || x.to_node_instance_id === n.id)) await repo.setDependencyState(tx, d.id, 'DISABLED');
      await repo.completeOpenTasks(tx, n.id, ['CONDITION_VERIFICATION'], ctx.now);
      await repo.insertTransition(tx, { nodeId: n.id, fromActivation: 'INACTIVE', toActivation: 'NOT_APPLICABLE', fromExecution: n.execution_state, toExecution: n.execution_state,
        actorUserId: ctx.actor?.userId ?? null, reason: 'CONDITION_RESOLVED_NOT_APPLICABLE', metadata: { leaves: ev.leaves }, at: ctx.now });
    } else {
      await repo.updateNode(tx, n.id, { blocking_reason: null });
      for (const d of deps.filter((x) => x.from_node_instance_id === n.id && x.dependency_type === 'CONDITIONAL' && x.state === 'ACTIVE')) {
        await repo.setDependencyState(tx, d.id, 'ACTIVE', 'BLOCKING');
      }
      await repo.completeOpenTasks(tx, n.id, ['CONDITION_VERIFICATION'], ctx.now);
      await repo.insertTransition(tx, { nodeId: n.id, fromActivation: 'INACTIVE', toActivation: 'INACTIVE', fromExecution: n.execution_state, toExecution: n.execution_state,
        actorUserId: ctx.actor?.userId ?? null, reason: 'CONDITION_RESOLVED_APPLICABLE', metadata: { leaves: ev.leaves }, at: ctx.now });
    }
    resolved.push(n.node_code);
    await audit(tx, ctx, { action: 'workflow.condition_resolved', entityType: 'workflow_node_instance', entityId: n.id, projectId,
      newData: { nodeCode: n.node_code, result: ev.result }, metadata: { leaves: ev.leaves } });
  }
  if (resolved.length) await recompute(tx, ctx, projectId);
  return { resolved };
}
