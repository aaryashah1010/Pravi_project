// Readiness rules for the workflow engine (pure). Deterministic; never consults an LLM.

export const GATING_TYPES = ['BLOCKING', 'REQUIRES_COMPLETION'] as const;
export const isGatingType = (t: string): boolean => (GATING_TYPES as readonly string[]).includes(t);

export interface NodeState {
  code: string;
  nodeType: string;
  activation: string; // INACTIVE|ELIGIBLE|ACTIVE|SKIPPED|NOT_APPLICABLE|BLOCKED|COMPLETED
  execution: string; // PENDING|IN_PROGRESS|WAITING|COMPLETED|RETURNED|REJECTED|FAILED|CANCELLED
  conditionPending: boolean;
}

export interface DepState {
  from: string;
  to: string;
  type: string;
  state: string; // ACTIVE|SATISFIED|WAIVED|DISABLED
}

/** A predecessor is satisfied when complete, not applicable, skipped, or the dependency was explicitly waived. */
export function predecessorSatisfied(n: NodeState): boolean {
  return n.execution === 'COMPLETED' || n.activation === 'COMPLETED' || n.activation === 'NOT_APPLICABLE' || n.activation === 'SKIPPED';
}

export function gatingPredecessors(code: string, deps: DepState[]): DepState[] {
  return deps.filter((d) => d.to === code && d.state === 'ACTIVE' && isGatingType(d.type));
}

/** Nodes that may move INACTIVE -> ELIGIBLE now: not pending a fact, and every ACTIVE gating predecessor is satisfied. */
export function nodesReadyToActivate(nodes: NodeState[], deps: DepState[]): string[] {
  const byCode = new Map(nodes.map((n) => [n.code, n]));
  return nodes
    .filter((n) => n.activation === 'INACTIVE' && !n.conditionPending)
    .filter((n) => gatingPredecessors(n.code, deps).every((d) => predecessorSatisfied(byCode.get(d.from)!)))
    .map((n) => n.code);
}

/** Direct + transitive successors over ACTIVE gating dependencies (cycle-safe, depth-capped). */
export function downstreamOf(code: string, deps: DepState[], maxDepth = 50): { code: string; depth: number }[] {
  const out = new Map<string, number>();
  let frontier = [code];
  for (let depth = 1; depth <= maxDepth && frontier.length; depth++) {
    const next: string[] = [];
    for (const f of frontier) {
      for (const d of deps) {
        if (d.from === f && d.state === 'ACTIVE' && isGatingType(d.type) && !out.has(d.to) && d.to !== code) {
          out.set(d.to, depth);
          next.push(d.to);
        }
      }
    }
    frontier = next;
  }
  return [...out].map(([c, depth]) => ({ code: c, depth }));
}
