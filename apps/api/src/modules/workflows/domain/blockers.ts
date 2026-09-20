// Root-blocker analysis (pure). Deterministic graph computation; an LLM may explain the result but never produces it.
//
// FRONTIER node: live (ELIGIBLE/ACTIVE/BLOCKED), not waiting on a fact, and with at least one INCOMPLETE gating successor.
// (Every gating predecessor of a live node is already satisfied, so a frontier node is by definition a ROOT candidate.)
// A frontier node is a *blocker candidate* only when there is evidence of a problem: an open blocking issue,
// a rejected approval, or it is past its configured SLA. On-schedule work is shown as frontier, never as a blocker.
import { type DepState, downstreamOf } from './readiness.js';

const DAY = 86_400_000;

export type BlockKind = 'ISSUE' | 'REJECTED' | null;

export interface BlockerNode {
  code: string;
  activation: string;
  execution: string;
  conditionPending: boolean;
  eligibleAt: Date | null;
  dueAt: Date | null;
  blockKind: BlockKind;
  blockingIssueCount: number;
}

export type BlockerReason = 'ISSUE_BLOCKS' | 'APPROVAL_REJECTED' | 'SLA_OVERDUE';

export interface FrontierItem {
  code: string;
  activation: string;
  ageDays: number;
  overdue: boolean;
  overdueDays: number;
  downstream: { code: string; depth: number }[];
  reason: BlockerReason | null;
}

export interface BlockerAnalysis {
  /** Flagged blockers, most impactful first. */
  blockers: FrontierItem[];
  /** All frontier nodes (flagged or not). */
  frontier: FrontierItem[];
  /** Live nodes that can be worked on right now, in parallel (blocked ones excluded). */
  parallelEligible: string[];
}

const isLive = (n: BlockerNode) => ['ELIGIBLE', 'ACTIVE', 'BLOCKED'].includes(n.activation);
const isDone = (n: BlockerNode) => n.activation === 'COMPLETED' || n.activation === 'NOT_APPLICABLE' || n.activation === 'SKIPPED';

export function analyzeBlockers(nodes: BlockerNode[], deps: DepState[], now: Date): BlockerAnalysis {
  const byCode = new Map(nodes.map((n) => [n.code, n]));
  const frontier: FrontierItem[] = [];

  for (const n of nodes.filter((x) => isLive(x) && !x.conditionPending)) {
    const downstream = downstreamOf(n.code, deps).filter((d) => {
      const t = byCode.get(d.code);
      return !!t && !isDone(t);
    });
    if (downstream.length === 0) continue;

    const overdueMs = n.dueAt ? now.getTime() - n.dueAt.getTime() : 0;
    const overdue = overdueMs > 0 && n.activation !== 'COMPLETED';
    const reason: BlockerReason | null =
      n.blockKind === 'REJECTED' ? 'APPROVAL_REJECTED' : n.blockKind === 'ISSUE' || n.blockingIssueCount > 0 ? 'ISSUE_BLOCKS' : overdue ? 'SLA_OVERDUE' : null;

    frontier.push({
      code: n.code,
      activation: n.activation,
      ageDays: n.eligibleAt ? Math.max(0, Math.floor((now.getTime() - n.eligibleAt.getTime()) / DAY)) : 0,
      overdue,
      overdueDays: overdue ? Math.floor(overdueMs / DAY) : 0,
      downstream: downstream.sort((a, b) => a.depth - b.depth || a.code.localeCompare(b.code)),
      reason,
    });
  }

  const weight = (f: FrontierItem) => (f.reason === 'APPROVAL_REJECTED' ? 3 : f.reason === 'ISSUE_BLOCKS' ? 2 : f.reason === 'SLA_OVERDUE' ? 1 : 0);
  const blockers = frontier
    .filter((f) => f.reason !== null)
    .sort((a, b) => weight(b) - weight(a) || b.downstream.length - a.downstream.length || b.ageDays - a.ageDays || a.code.localeCompare(b.code));

  const parallelEligible = nodes.filter((n) => (n.activation === 'ELIGIBLE' || n.activation === 'ACTIVE') && !n.conditionPending).map((n) => n.code);

  return { blockers, frontier, parallelEligible };
}
