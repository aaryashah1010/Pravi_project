import clsx from 'clsx';
import { useMemo } from 'react';
import { Background, Controls, Handle, MarkerType, Position, ReactFlow, type Edge, type Node, type NodeProps } from '@xyflow/react';
import type { BlockersDto, WorkflowDto, WorkflowNodeDto } from '@infraflow/shared';
import { Icon } from '@/components/ui/Icon';
import { Badge } from '@/components/ui/Badge';
import { GATE_KIND_SHORT, TONE, nodeState } from '@/lib/labels';
import { days } from '@/lib/format';
import { NODE_W, NODE_H, blockerSets, edgeStyle, layoutNodes, reach, visibleEdges } from './graph';
import { NodeDrawer } from './NodeDrawer';

type Focus = 'self' | 'up' | 'down' | null;

interface FlowData extends Record<string, unknown> {
  n: WorkflowNodeDto;
  root: boolean;
  downstream: boolean;
  /** Relationship to the selected step: itself, a prerequisite above it, or something it unlocks below it. */
  focus: Focus;
  dim: boolean;
}

function FlowNode({ data, selected }: NodeProps<Node<FlowData>>) {
  const { n, root, downstream, focus, dim } = data;
  const st = nodeState(n.activationState, n.overdue);
  const na = n.activationState === 'NOT_APPLICABLE';
  const pending = n.gateKind === 'CONDITIONAL_PENDING';
  const rail = root ? TONE.rose.rail : pending ? TONE.slate.rail : TONE[st.tone].rail;
  const owner = n.assignedPosition ? `${n.assignedPosition.designation}${n.assignedPosition.holder ? '' : ' (vacant)'}` : n.approval ? 'Authority pending' : '—';
  const timing =
    n.ageDays != null && !['COMPLETED', 'NOT_APPLICABLE'].includes(n.activationState)
      ? `${days(n.ageDays)}${n.slaDays != null ? ` / ${n.slaDays}d SLA` : ''}`
      : n.completedAt
        ? 'done'
        : '';
  return (
    <div
      style={{ width: NODE_W, height: NODE_H }}
      className={clsx(
        'relative flex overflow-hidden rounded-lg border bg-white shadow-sm transition-shadow',
        selected && 'ring-2 ring-secondary ring-offset-1',
        focus === 'up' && 'ring-2 ring-blue-500/70 ring-offset-1',
        focus === 'down' && 'ring-2 ring-indigo-500/70 ring-offset-1',
        dim && 'opacity-40',
        root ? 'border-red-500' : downstream ? 'border-red-200 bg-red-50/50' : 'border-slate-300',
        pending && 'border-dashed',
        na && 'opacity-55',
      )}
      title={`${n.name} - ${st.label}`}
    >
      <Handle type="target" position={Position.Top} className="!h-1 !w-1 !border-0 !bg-transparent" />
      <span className={clsx('w-1 shrink-0', rail)} aria-hidden="true" />
      <div className="flex min-w-0 flex-1 flex-col justify-between px-2.5 py-1.5">
        <div className="flex items-start justify-between gap-1">
          <span className="line-clamp-2 text-[13px] font-semibold leading-[15px] text-slate-900">{n.name}</span>
          {root ? <span className="shrink-0 rounded bg-red-600 px-1 py-px text-[9px] font-bold uppercase leading-3 tracking-wide text-white">Root blocker</span> : null}
          {!root && focus === 'up' ? <span className="shrink-0 rounded bg-blue-600 px-1 py-px text-[9px] font-bold uppercase leading-3 tracking-wide text-white">Depends on</span> : null}
          {!root && focus === 'down' ? <span className="shrink-0 rounded bg-indigo-600 px-1 py-px text-[9px] font-bold uppercase leading-3 tracking-wide text-white">Unlocks</span> : null}
        </div>
        <div className="flex items-center gap-1 text-[11px] text-slate-600">
          <Icon name={st.icon} className={clsx('text-[13px]', TONE[st.tone].soft)} filled />
          <span className="truncate font-medium">{st.label}</span>
          <span className="text-slate-300">·</span>
          <span className="truncate">{owner}</span>
        </div>
        <div className="flex items-center justify-between gap-1 font-code-sm text-[10px] text-slate-500">
          <span className="truncate">{GATE_KIND_SHORT[n.gateKind]}{n.rule ? ` · ${n.rule.ruleCode}` : ''}</span>
          <span className={clsx('shrink-0', n.overdue && 'font-semibold text-amber-700')}>{timing}</span>
        </div>
      </div>
      <Handle type="source" position={Position.Bottom} className="!h-1 !w-1 !border-0 !bg-transparent" />
    </div>
  );
}

const nodeTypes = { step: FlowNode };

interface Props {
  wf: WorkflowDto;
  blockers: BlockersDto | undefined;
  selectedCode: string | null;
  onSelect: (code: string | null) => void;
  projectId: string;
}

export function WorkflowGraph({ wf, blockers, selectedCode, onSelect, projectId }: Props) {
  const sets = useMemo(() => blockerSets(blockers), [blockers]);
  const { nodes, edges } = useMemo(() => {
    const pos = layoutNodes(wf.nodes, wf.edges);
    const up = new Set(selectedCode ? reach(selectedCode, wf.edges, 'up').map((r) => r.code) : []);
    const down = new Set(selectedCode ? reach(selectedCode, wf.edges, 'down').map((r) => r.code) : []);
    const focusOf = (code: string): Focus => (code === selectedCode ? 'self' : up.has(code) ? 'up' : down.has(code) ? 'down' : null);
    const nodes: Node<FlowData>[] = wf.nodes.map((n) => {
      const focus = focusOf(n.nodeCode);
      return {
        id: n.nodeCode,
        type: 'step',
        position: pos.get(n.nodeCode)!,
        data: { n, root: sets.root.has(n.nodeCode), downstream: sets.downstream.has(n.nodeCode) && !sets.root.has(n.nodeCode), focus, dim: !!selectedCode && !focus },
        selected: n.nodeCode === selectedCode,
        draggable: false,
      };
    });
    const edges: Edge[] = visibleEdges(wf.edges).map((e) => {
      const rawStyle = edgeStyle(e, wf, sets);
      let style: Record<string, string | number> = Object.fromEntries(Object.entries(rawStyle).filter(([, v]) => v !== undefined)) as Record<string, string | number>;
      const fromF = focusOf(e.from);
      const toF = focusOf(e.to);
      if (selectedCode) {
        if ((fromF === 'up' || fromF === 'self') && (toF === 'up' || toF === 'self') && (fromF === 'up' || toF === 'up')) style = { stroke: '#2563eb', strokeWidth: 2.5 };
        else if ((fromF === 'down' || fromF === 'self') && (toF === 'down' || toF === 'self') && (fromF === 'down' || toF === 'down')) style = { stroke: '#4f46e5', strokeWidth: 2.5 };
        else style = { ...style, opacity: 0.25 };
      }
      return { id: e.id, source: e.from, target: e.to, style, markerEnd: { type: MarkerType.ArrowClosed, color: String(style.stroke), width: 16, height: 16 }, selectable: false };
    });
    return { nodes, edges };
  }, [wf, sets, selectedCode]);

  const selected = wf.nodes.find((n) => n.nodeCode === selectedCode) ?? null;
  const s = wf.summary;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="emerald" label={`${s.completed} completed`} icon="check_circle" />
        <Badge tone="blue" label={`${s.eligible + s.active} in progress`} icon="play_circle" />
        <Badge tone="rose" label={`${sets.root.size || s.blocked} ${sets.root.size ? 'root blocker' + (sets.root.size > 1 ? 's' : '') : 'blocked'}`} icon="block" />
        <Badge tone="amber" label={`${s.pendingVerification} pending verification`} icon="pending_actions" />
        <Badge tone="slate" label={`${s.notApplicable} not applicable`} icon="do_not_disturb_on" />
        <span className="ml-auto flex flex-wrap items-center gap-3 text-body-sm text-on-surface-variant">
          <Legend swatch="border-t-2 border-slate-400" label="Completed path" />
          <Legend swatch="border-t-2 border-dashed border-slate-300" label="Pending" />
          <Legend swatch="border-t-2 border-dashed border-red-600" label="Blocked chain" />
          <Legend swatch="border-t-2 border-dotted border-slate-300" label="Informational / conditional" />
          <Legend swatch="border-t-2 border-blue-600" label="Depends on (upstream)" />
          <Legend swatch="border-t-2 border-indigo-600" label="Unlocks (downstream)" />
        </span>
      </div>

      <div className="relative h-[calc(100vh-17rem)] min-h-[520px] overflow-hidden rounded-lg border border-slate-300 bg-slate-50">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.12 }}
          minZoom={0.25}
          maxZoom={1.5}
          nodesDraggable={false}
          nodesConnectable={false}
          edgesFocusable={false}
          onNodeClick={(_, n) => onSelect(n.id)}
          onPaneClick={() => onSelect(null)}
          proOptions={{ hideAttribution: true }}
        >
          <Background color="#e2e8f0" gap={20} />
          <Controls showInteractive={false} position="bottom-left" />
        </ReactFlow>
        {selected ? <NodeDrawer node={selected} wf={wf} blockers={blockers} projectId={projectId} onClose={() => onSelect(null)} onSelect={onSelect} /> : null}
        {!selected ? (
          <p className="pointer-events-none absolute bottom-3 right-3 rounded bg-white/90 px-2 py-1 text-body-sm text-on-surface-variant shadow-sm">
            Select a step to trace what it depends on (above) and what it unlocks (below).
          </p>
        ) : null}
      </div>
    </div>
  );
}

function Legend({ swatch, label }: { swatch: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={clsx('inline-block w-6', swatch)} aria-hidden="true" />
      {label}
    </span>
  );
}
