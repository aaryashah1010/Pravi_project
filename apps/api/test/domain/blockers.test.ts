import { describe, expect, it } from 'vitest';
import { type BlockerNode, analyzeBlockers } from '../../src/modules/workflows/domain/blockers.js';
import type { DepState } from '../../src/modules/workflows/domain/readiness.js';

const now = new Date('2026-09-20T12:00:00Z');
const daysAgo = (d: number) => new Date(now.getTime() - d * 86_400_000);
const n = (code: string, activation: string, over: Partial<BlockerNode> = {}): BlockerNode => ({
  code, activation, execution: activation === 'COMPLETED' ? 'COMPLETED' : 'PENDING', conditionPending: false,
  eligibleAt: null, dueAt: null, blockKind: null, blockingIssueCount: 0, ...over,
});
const dep = (from: string, to: string, type = 'BLOCKING', state = 'ACTIVE'): DepState => ({ from, to, type, state });

// SITE -> START -> F -> S -> FIN ; BUDGET -> AA (independent branch)
const deps = [dep('SITE', 'START'), dep('START', 'F'), dep('F', 'S'), dep('S', 'FIN'), dep('BUDGET', 'AA')];
const base = () => [n('SITE', 'ELIGIBLE'), n('START', 'INACTIVE'), n('F', 'INACTIVE'), n('S', 'INACTIVE'), n('FIN', 'INACTIVE'), n('BUDGET', 'ELIGIBLE'), n('AA', 'INACTIVE')];

describe('analyzeBlockers', () => {
  it('on-schedule frontier nodes are listed but are NOT blockers', () => {
    const r = analyzeBlockers(base(), deps, now);
    expect(r.blockers).toEqual([]);
    expect(r.frontier.map((f) => f.code).sort()).toEqual(['BUDGET', 'SITE']);
    expect(r.parallelEligible.sort()).toEqual(['BUDGET', 'SITE']);
  });

  it('a frontier node past its configured SLA is a root blocker with transitive downstream impact', () => {
    const nodes = base();
    nodes[0] = n('SITE', 'ELIGIBLE', { eligibleAt: daysAgo(8), dueAt: daysAgo(5) });
    const r = analyzeBlockers(nodes, deps, now);
    expect(r.blockers).toHaveLength(1);
    const b = r.blockers[0]!;
    expect(b).toMatchObject({ code: 'SITE', reason: 'SLA_OVERDUE', ageDays: 8, overdue: true, overdueDays: 5 });
    expect(b.downstream.map((d) => [d.code, d.depth])).toEqual([['START', 1], ['F', 2], ['S', 3], ['FIN', 4]]);
  });

  it('only the ROOT is reported: a blocked successor is never itself a blocker', () => {
    const nodes = base();
    nodes[0] = n('SITE', 'ELIGIBLE', { eligibleAt: daysAgo(8), dueAt: daysAgo(5) });
    nodes[1] = n('START', 'INACTIVE', { eligibleAt: null, dueAt: daysAgo(2) }); // inactive: not live, cannot be a root
    const r = analyzeBlockers(nodes, deps, now);
    expect(r.blockers.map((b) => b.code)).toEqual(['SITE']);
  });

  it('an open blocking issue outranks a merely overdue node, regardless of impact size', () => {
    const nodes = [...base(), n('X', 'BLOCKED', { blockKind: 'ISSUE', blockingIssueCount: 1, eligibleAt: daysAgo(1) }), n('Y', 'INACTIVE')];
    nodes[0] = n('SITE', 'ELIGIBLE', { eligibleAt: daysAgo(8), dueAt: daysAgo(5) });
    const r = analyzeBlockers(nodes, [...deps, dep('X', 'Y')], now);
    expect(r.blockers.map((b) => [b.code, b.reason])).toEqual([['X', 'ISSUE_BLOCKS'], ['SITE', 'SLA_OVERDUE']]);
    expect(r.parallelEligible).not.toContain('X');
  });

  it('a rejected approval outranks everything', () => {
    const nodes = [...base(), n('R', 'BLOCKED', { blockKind: 'REJECTED' }), n('Z', 'INACTIVE')];
    const r = analyzeBlockers(nodes, [...deps, dep('R', 'Z')], now);
    expect(r.blockers[0]).toMatchObject({ code: 'R', reason: 'APPROVAL_REJECTED' });
  });

  it('nodes with no incomplete successors, informational edges, or awaiting a fact cannot block', () => {
    const nodes = [n('A', 'ELIGIBLE', { dueAt: daysAgo(9) }), n('B', 'INACTIVE'), n('C', 'ELIGIBLE', { dueAt: daysAgo(9), conditionPending: true }), n('D', 'INACTIVE')];
    const r = analyzeBlockers(nodes, [dep('A', 'B', 'INFORMATIONAL'), dep('C', 'D')], now);
    expect(r.blockers).toEqual([]);
    expect(r.frontier).toEqual([]);
  });

  it('completed / not-applicable successors do not count as impact', () => {
    const nodes = [n('A', 'ELIGIBLE', { dueAt: daysAgo(3), eligibleAt: daysAgo(4) }), n('B', 'COMPLETED'), n('C', 'INACTIVE')];
    const r = analyzeBlockers(nodes, [dep('A', 'B'), dep('A', 'C')], now);
    expect(r.blockers[0]!.downstream.map((d) => d.code)).toEqual(['C']);
  });

  it('ranks by downstream size then age when reasons tie', () => {
    const nodes = [
      n('P', 'ELIGIBLE', { dueAt: daysAgo(1), eligibleAt: daysAgo(2) }), n('P1', 'INACTIVE'),
      n('Q', 'ELIGIBLE', { dueAt: daysAgo(1), eligibleAt: daysAgo(9) }), n('Q1', 'INACTIVE'), n('Q2', 'INACTIVE'),
    ];
    const r = analyzeBlockers(nodes, [dep('P', 'P1'), dep('Q', 'Q1'), dep('Q1', 'Q2')], now);
    expect(r.blockers.map((b) => b.code)).toEqual(['Q', 'P']);
  });
});
