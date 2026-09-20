import { describe, expect, it } from 'vitest';
import { planWorkflow, type RuleIn, type TemplateEdgeIn, type TemplateNodeIn } from '../../src/modules/workflows/domain/generator.js';
import { downstreamOf, nodesReadyToActivate, type DepState, type NodeState } from '../../src/modules/workflows/domain/readiness.js';

const at = new Date('2026-09-20T00:00:00Z');
const rule = (id: string, over: Partial<RuleIn> = {}): RuleIn => ({
  id,
  rule_code: id.toUpperCase(),
  enforcement_mode: 'ENFORCEABLE',
  verification_status: 'VERIFIED',
  effective_from: null,
  effective_to: null,
  scope: {},
  conditions: {},
  action: {},
  ...over,
});
const node = (code: string, over: Partial<TemplateNodeIn> = {}): TemplateNodeIn => ({
  id: `n-${code}`,
  node_code: code,
  name: code,
  node_type: 'TASK',
  required_by_default: true,
  activation_condition: {},
  assigned_position_type_id: null,
  rule_version_id: null,
  config: { sla_days: 3 },
  ...over,
});
const edge = (from: string, to: string, dependency_type: TemplateEdgeIn['dependency_type'] = 'BLOCKING'): TemplateEdgeIn => ({
  from_node_template_id: `n-${from}`,
  to_node_template_id: `n-${to}`,
  dependency_type,
  condition: {},
});

describe('planWorkflow', () => {
  const rules = new Map<string, RuleIn>([
    ['r-exec', rule('r-exec')],
    ['r-adv', rule('r-adv', { enforcement_mode: 'ADVISORY_ONLY' })],
    ['r-unv', rule('r-unv', { enforcement_mode: 'ADVISORY_ONLY', verification_status: 'UNVERIFIED' })],
  ]);
  const localCond = { all: [{ fact: 'attributes.local_body_approval_required', op: 'eq', value: true }] };

  it('classifies gate kinds by the linked rule, not by node type', () => {
    const plan = planWorkflow({
      nodes: [node('A'), node('B', { rule_version_id: 'r-exec' }), node('C', { rule_version_id: 'r-adv' }), node('D', { rule_version_id: 'r-unv' })],
      edges: [],
      rules,
      facts: {},
      at,
    });
    const kinds = Object.fromEntries(plan.nodes.map((n) => [n.nodeCode, n.gateKind]));
    expect(kinds).toEqual({ A: 'CONFIGURED', B: 'RULE_BACKED', C: 'ADVISORY', D: 'ADVISORY' });
  });

  it('a conditional node with an unknown fact is CONDITIONAL_PENDING (never silently not-applicable)', () => {
    const plan = planWorkflow({ nodes: [node('LB', { activation_condition: localCond, rule_version_id: 'r-exec' })], edges: [], rules, facts: { attributes: {} }, at });
    const lb = plan.nodes[0]!;
    expect(lb.gateKind).toBe('CONDITIONAL_PENDING');
    expect(lb.activationState).toBe('INACTIVE');
    expect(lb.blockingReason).toMatchObject({ type: 'CONDITION_UNKNOWN', facts: ['attributes.local_body_approval_required'], ruleCode: 'R-EXEC' });
    expect(plan.evaluations[0]).toMatchObject({ result: 'INDETERMINATE' });
  });

  it('a conditional node that does not apply is NOT_APPLICABLE and its dependencies are DISABLED', () => {
    const plan = planWorkflow({
      nodes: [node('X'), node('LB', { activation_condition: localCond }), node('Y')],
      edges: [edge('X', 'LB'), edge('LB', 'Y', 'CONDITIONAL')],
      rules,
      facts: { attributes: { local_body_approval_required: false } },
      at,
    });
    expect(plan.nodes.find((n) => n.nodeCode === 'LB')).toMatchObject({ gateKind: 'NOT_APPLICABLE', activationState: 'NOT_APPLICABLE' });
    expect(plan.dependencies.every((d) => d.state === 'DISABLED')).toBe(true);
  });

  it('a conditional edge stays non-gating while its source is pending, and becomes BLOCKING once the source applies', () => {
    const nodes = [node('LB', { activation_condition: localCond }), node('Y')];
    const edges = [edge('LB', 'Y', 'CONDITIONAL')];
    const pending = planWorkflow({ nodes, edges, rules, facts: {}, at });
    expect(pending.dependencies[0]).toMatchObject({ dependencyType: 'CONDITIONAL', originalType: 'CONDITIONAL', state: 'ACTIVE' });
    const applies = planWorkflow({ nodes, edges, rules, facts: { attributes: { local_body_approval_required: true } }, at });
    expect(applies.dependencies[0]).toMatchObject({ dependencyType: 'BLOCKING', originalType: 'CONDITIONAL', state: 'ACTIVE' });
    expect(applies.nodes[0]!.gateKind).toBe('CONFIGURED');
  });

  it('records an evaluation per rule-linked node and reports malformed conditions as ERROR', () => {
    const plan = planWorkflow({
      nodes: [node('A', { rule_version_id: 'r-exec', activation_condition: { fact: 'x', op: 'like', value: 1 } })],
      edges: [],
      rules,
      facts: {},
      at,
    });
    expect(plan.evaluations).toHaveLength(1);
    expect(plan.evaluations[0]!.result).toBe('ERROR');
    expect(plan.nodes[0]!.gateKind).toBe('CONDITIONAL_PENDING');
  });

  it('extracts sla_days only when numeric', () => {
    const plan = planWorkflow({ nodes: [node('A', { config: { sla_days: 5 } }), node('B', { config: { sla_days: 'x' } }), node('C', { config: {} })], edges: [], rules, facts: {}, at });
    expect(plan.nodes.map((n) => n.slaDays)).toEqual([5, null, null]);
  });
});

describe('readiness', () => {
  const ns = (code: string, activation = 'INACTIVE', execution = 'PENDING', conditionPending = false): NodeState => ({ code, nodeType: 'TASK', activation, execution, conditionPending });
  const dep = (from: string, to: string, type = 'BLOCKING', state = 'ACTIVE'): DepState => ({ from, to, type, state });

  it('roots (no gating predecessors) are ready immediately', () => {
    expect(nodesReadyToActivate([ns('A'), ns('B')], [dep('A', 'B')])).toEqual(['A']);
  });

  it('a node is ready when every gating predecessor is complete or not applicable', () => {
    const nodes = [ns('A', 'COMPLETED', 'COMPLETED'), ns('N', 'NOT_APPLICABLE'), ns('B')];
    expect(nodesReadyToActivate(nodes, [dep('A', 'B'), dep('N', 'B')])).toEqual(['B']);
  });

  it('informational, parallel, conditional and disabled dependencies never gate', () => {
    const nodes = [ns('A'), ns('B')];
    for (const type of ['INFORMATIONAL', 'PARALLEL', 'CONDITIONAL']) expect(nodesReadyToActivate(nodes, [dep('A', 'B', type)])).toContain('B');
    expect(nodesReadyToActivate(nodes, [dep('A', 'B', 'BLOCKING', 'DISABLED')])).toContain('B');
  });

  it('a node awaiting a fact is never activated', () => {
    expect(nodesReadyToActivate([ns('LB', 'INACTIVE', 'PENDING', true)], [])).toEqual([]);
  });

  it('an incomplete (eligible/active) predecessor keeps the successor waiting', () => {
    expect(nodesReadyToActivate([ns('A', 'ACTIVE', 'IN_PROGRESS'), ns('B')], [dep('A', 'B', 'REQUIRES_COMPLETION')])).toEqual([]);
  });

  it('downstreamOf is transitive over gating edges only, cycle-safe, with depths', () => {
    const deps = [dep('A', 'B'), dep('B', 'C'), dep('B', 'D', 'INFORMATIONAL'), dep('C', 'A'), dep('C', 'E', 'REQUIRES_COMPLETION')];
    const d = downstreamOf('A', deps);
    expect(Object.fromEntries(d.map((x) => [x.code, x.depth]))).toEqual({ B: 1, C: 2, E: 3 });
  });
});
