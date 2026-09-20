// Workflow generation planner (pure: no HTTP/DB). Turns (template, rule versions, project facts) into a plan.
//
// Legal force comes ONLY from a node's linked rule_version:
//   RULE_BACKED  -> rule is executable (ENFORCEABLE + VERIFIED + effective)   => "mandatory gate, verified rule"
//   CONFIGURED   -> no rule linked                                            => "configured prerequisite" (structure only)
//   ADVISORY     -> rule linked but NOT executable                            => shown, never called a legal requirement
//   CONDITIONAL_PENDING -> applicability depends on a fact we do not have     => a human must supply the fact
//   NOT_APPLICABLE -> activation condition evaluated NO_MATCH                 => dependencies disabled
import { type Facts, type Tri, safeEvaluate, type LeafTrace } from '../../rules/domain/condition.js';
import { type RuleVersionLike, isExecutable } from '../../rules/domain/rule-status.js';

export type GateKind = 'RULE_BACKED' | 'CONFIGURED' | 'ADVISORY' | 'CONDITIONAL_PENDING' | 'NOT_APPLICABLE';
export type DependencyType = 'BLOCKING' | 'REQUIRES_COMPLETION' | 'INFORMATIONAL' | 'PARALLEL' | 'CONDITIONAL';

export interface TemplateNodeIn {
  id: string;
  node_code: string;
  name: string;
  node_type: string;
  required_by_default: boolean;
  activation_condition: Record<string, unknown>;
  assigned_position_type_id: string | null;
  rule_version_id: string | null;
  config: Record<string, unknown>;
}

export interface TemplateEdgeIn {
  from_node_template_id: string;
  to_node_template_id: string;
  dependency_type: DependencyType;
  condition: Record<string, unknown>;
}

export interface RuleIn extends RuleVersionLike {
  id: string;
  rule_code: string;
}

export interface PlannedNode {
  templateNodeId: string;
  nodeCode: string;
  name: string;
  nodeType: string;
  activationState: 'INACTIVE' | 'NOT_APPLICABLE';
  gateKind: GateKind;
  blockingReason: null | { type: 'CONDITION_UNKNOWN'; facts: string[]; ruleCode: string | null; message: string };
  sourceRuleVersionId: string | null;
  assignedPositionTypeId: string | null;
  slaDays: number | null;
  config: Record<string, unknown>;
}

export interface PlannedDependency {
  fromNodeCode: string;
  toNodeCode: string;
  dependencyType: DependencyType;
  originalType: DependencyType;
  state: 'ACTIVE' | 'DISABLED';
  condition: Record<string, unknown>;
}

export interface PlannedEvaluation {
  nodeCode: string;
  ruleVersionId: string;
  result: Tri | 'ERROR';
  explanation: {
    nodeCode: string;
    ruleCode: string;
    gateKind: GateKind;
    executable: boolean;
    activation: { result: Tri; leaves: LeafTrace[]; missingFacts: string[] };
    ruleConditionsResult: Tri;
    error?: string;
  };
}

export interface WorkflowPlan {
  nodes: PlannedNode[];
  dependencies: PlannedDependency[];
  evaluations: PlannedEvaluation[];
}

const numOrNull = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

export function planWorkflow(input: {
  nodes: TemplateNodeIn[];
  edges: TemplateEdgeIn[];
  rules: Map<string, RuleIn>;
  facts: Facts;
  at: Date;
}): WorkflowPlan {
  const { nodes, edges, rules, facts, at } = input;
  const plannedNodes: PlannedNode[] = [];
  const evaluations: PlannedEvaluation[] = [];
  const codeById = new Map(nodes.map((n) => [n.id, n.node_code]));

  for (const n of nodes) {
    const rule = n.rule_version_id ? (rules.get(n.rule_version_id) ?? null) : null;
    const act = safeEvaluate(n.activation_condition, facts);
    const ruleCond = rule ? safeEvaluate(rule.conditions, facts) : null;
    const executable = rule ? isExecutable(rule, at) : false;

    let gateKind: GateKind;
    let activationState: PlannedNode['activationState'] = 'INACTIVE';
    let blockingReason: PlannedNode['blockingReason'] = null;

    if (act.result === 'NO_MATCH') {
      gateKind = 'NOT_APPLICABLE';
      activationState = 'NOT_APPLICABLE';
    } else if (act.result === 'INDETERMINATE') {
      gateKind = 'CONDITIONAL_PENDING';
      blockingReason = {
        type: 'CONDITION_UNKNOWN',
        facts: act.missingFacts,
        ruleCode: rule?.rule_code ?? null,
        message: act.error
          ? `The applicability condition could not be evaluated (${act.error}). Manual verification required.`
          : `Applicability depends on ${act.missingFacts.join(', ')}, which is not recorded for this project. Manual verification required.`,
      };
    } else {
      gateKind = rule === null ? 'CONFIGURED' : executable ? 'RULE_BACKED' : 'ADVISORY';
    }

    plannedNodes.push({
      templateNodeId: n.id,
      nodeCode: n.node_code,
      name: n.name,
      nodeType: n.node_type,
      activationState,
      gateKind,
      blockingReason,
      sourceRuleVersionId: n.rule_version_id,
      assignedPositionTypeId: n.assigned_position_type_id,
      slaDays: numOrNull(n.config?.sla_days),
      config: n.config ?? {},
    });

    if (rule) {
      evaluations.push({
        nodeCode: n.node_code,
        ruleVersionId: rule.id,
        result: act.error ? 'ERROR' : act.result,
        explanation: {
          nodeCode: n.node_code,
          ruleCode: rule.rule_code,
          gateKind,
          executable,
          activation: { result: act.result, leaves: act.leaves, missingFacts: act.missingFacts },
          ruleConditionsResult: ruleCond!.result,
          ...(act.error ? { error: act.error } : {}),
        },
      });
    }
  }

  const byCode = new Map(plannedNodes.map((p) => [p.nodeCode, p]));
  const dependencies: PlannedDependency[] = [];
  for (const e of edges) {
    const fromCode = codeById.get(e.from_node_template_id)!;
    const toCode = codeById.get(e.to_node_template_id)!;
    const from = byCode.get(fromCode)!;
    const to = byCode.get(toCode)!;
    let type = e.dependency_type;
    let state: PlannedDependency['state'] = 'ACTIVE';

    if (from.gateKind === 'NOT_APPLICABLE' || to.gateKind === 'NOT_APPLICABLE') {
      state = 'DISABLED';
    } else if (e.dependency_type === 'CONDITIONAL') {
      // A conditional edge gates only once its source node is known to apply.
      type = from.gateKind === 'CONDITIONAL_PENDING' ? 'CONDITIONAL' : 'BLOCKING';
    }
    dependencies.push({ fromNodeCode: fromCode, toNodeCode: toCode, dependencyType: type, originalType: e.dependency_type, state, condition: e.condition ?? {} });
  }

  return { nodes: plannedNodes, dependencies, evaluations };
}
