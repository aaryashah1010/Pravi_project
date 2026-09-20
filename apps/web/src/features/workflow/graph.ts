import dagre from '@dagrejs/dagre';
import type { BlockersDto, WorkflowDto, WorkflowEdgeDto, WorkflowNodeDto } from '@infraflow/shared';

export const NODE_W = 240;
export const NODE_H = 76;

/** Edges that are in play on the canvas (disabled ones belong to not-applicable steps). */
export const visibleEdges = (edges: WorkflowEdgeDto[]) => edges.filter((e) => e.state !== 'DISABLED');

export const isGatingEdge = (e: WorkflowEdgeDto) => e.dependencyType === 'BLOCKING' || e.dependencyType === 'REQUIRES_COMPLETION';

/** Top-to-bottom dagre layout keyed by node code. */
export function layoutNodes(nodes: WorkflowNodeDto[], edges: WorkflowEdgeDto[]): Map<string, { x: number; y: number }> {
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: 'TB', nodesep: 36, ranksep: 70, marginx: 20, marginy: 20 });
  g.setDefaultEdgeLabel(() => ({}));
  for (const n of nodes) g.setNode(n.nodeCode, { width: NODE_W, height: NODE_H });
  for (const e of visibleEdges(edges)) g.setEdge(e.from, e.to);
  dagre.layout(g);
  const out = new Map<string, { x: number; y: number }>();
  for (const n of nodes) {
    const p = g.node(n.nodeCode);
    out.set(n.nodeCode, { x: p.x - NODE_W / 2, y: p.y - NODE_H / 2 });
  }
  return out;
}

/** Stable topological order (Kahn) so the lifecycle strip reads in process order. */
export function topoOrder(nodes: WorkflowNodeDto[], edges: WorkflowEdgeDto[]): WorkflowNodeDto[] {
  const indeg = new Map(nodes.map((n) => [n.nodeCode, 0]));
  const adj = new Map<string, string[]>();
  for (const e of visibleEdges(edges)) {
    indeg.set(e.to, (indeg.get(e.to) ?? 0) + 1);
    adj.set(e.from, [...(adj.get(e.from) ?? []), e.to]);
  }
  const byCode = new Map(nodes.map((n) => [n.nodeCode, n]));
  const queue = nodes.filter((n) => indeg.get(n.nodeCode) === 0).map((n) => n.nodeCode);
  const out: WorkflowNodeDto[] = [];
  while (queue.length) {
    const c = queue.shift()!;
    out.push(byCode.get(c)!);
    for (const t of adj.get(c) ?? []) {
      indeg.set(t, indeg.get(t)! - 1);
      if (indeg.get(t) === 0) queue.push(t);
    }
  }
  for (const n of nodes) if (!out.includes(n)) out.push(n);
  return out;
}

export interface BlockerSets {
  root: Set<string>;
  downstream: Set<string>;
}

export function blockerSets(b: BlockersDto | undefined): BlockerSets {
  const root = new Set<string>();
  const downstream = new Set<string>();
  for (const x of b?.blockers ?? []) {
    root.add(x.nodeCode);
    for (const d of x.downstream) downstream.add(d.nodeCode);
  }
  return { root, downstream };
}

export function edgeStyle(e: WorkflowEdgeDto, wf: WorkflowDto, sets: BlockerSets) {
  const src = wf.nodes.find((n) => n.nodeCode === e.from);
  const soft = !isGatingEdge(e);
  const onBlockedPath = !soft && (sets.root.has(e.from) || sets.downstream.has(e.from)) && sets.downstream.has(e.to);
  if (onBlockedPath) return { stroke: '#dc2626', strokeWidth: 2, strokeDasharray: '6 4' };
  if (soft) return { stroke: '#cbd5e1', strokeWidth: 1.25, strokeDasharray: '2 4' };
  if (src?.activationState === 'COMPLETED') return { stroke: '#94a3b8', strokeWidth: 2 };
  return { stroke: '#cbd5e1', strokeWidth: 2, strokeDasharray: '6 4' };
}

export interface Reach {
  code: string;
  depth: number;
}

/** Walk the gating graph from a step: `up` = everything it depends on (prerequisites), `down` = everything it unlocks. */
export function reach(code: string, edges: WorkflowEdgeDto[], dir: 'up' | 'down', maxDepth = 40): Reach[] {
  const gating = visibleEdges(edges).filter(isGatingEdge);
  const next = (c: string) => gating.filter((e) => (dir === 'up' ? e.to === c : e.from === c)).map((e) => (dir === 'up' ? e.from : e.to));
  const seen = new Map<string, number>();
  let frontier = [code];
  for (let d = 1; d <= maxDepth && frontier.length; d++) {
    const step: string[] = [];
    for (const c of frontier) {
      for (const n of next(c)) {
        if (n !== code && !seen.has(n)) {
          seen.set(n, d);
          step.push(n);
        }
      }
    }
    frontier = step;
  }
  return [...seen].map(([c, depth]) => ({ code: c, depth }));
}

const isDone = (n: WorkflowNodeDto) => n.activationState === 'COMPLETED' || n.activationState === 'NOT_APPLICABLE' || n.activationState === 'SKIPPED';

/**
 * Root causes for a step that cannot proceed: the nearest INCOMPLETE ancestors whose own prerequisites are all satisfied
 * (the frontier). Empty when the step's prerequisites are complete.
 */
export function rootCauses(code: string, wf: WorkflowDto): WorkflowNodeDto[] {
  const byCode = new Map(wf.nodes.map((n) => [n.nodeCode, n]));
  const gating = visibleEdges(wf.edges).filter(isGatingEdge);
  const incompleteAncestors = reach(code, wf.edges, 'up').map((r) => byCode.get(r.code)!).filter((n) => !isDone(n));
  return incompleteAncestors.filter((n) => gating.filter((e) => e.to === n.nodeCode).every((e) => isDone(byCode.get(e.from)!)));
}

export const directNeighbours = (code: string, wf: WorkflowDto, dir: 'up' | 'down'): { edge: WorkflowEdgeDto; node: WorkflowNodeDto }[] =>
  visibleEdges(wf.edges)
    .filter((e) => (dir === 'up' ? e.to === code : e.from === code))
    .map((e) => ({ edge: e, node: wf.nodes.find((n) => n.nodeCode === (dir === 'up' ? e.from : e.to))! }))
    .filter((x) => !!x.node);
