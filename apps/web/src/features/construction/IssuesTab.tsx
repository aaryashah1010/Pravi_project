import { useState } from 'react';
import type { ProjectDetailDto, IssueDto } from '@infraflow/shared';
import { ISSUE_CATEGORIES, ISSUE_SEVERITIES } from '@infraflow/shared';
import { useIssues, useCreateIssue, useResolveIssue, useWorkflow } from '@/lib/queries';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/components/ui/Toast';
import { errorMessage } from '@/lib/api';
import { Kpi } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Badge, CodeTag, OverdueChip } from '@/components/ui/Badge';
import { Modal, Drawer } from '@/components/ui/Overlay';
import { EmptyState, ErrorNotice, SkeletonRows } from '@/components/ui/States';
import { TextInput, TextAreaField, SelectField } from '@/components/ui/Form';
import { TABLE, THEAD, TH, TR, TD, TD_MONO } from '@/components/ui/table';
import { formatDate, humanize, plural } from '@/lib/format';
import { isOpenIssueStatus, type Tone } from '@/lib/labels';

function severityTone(severity: string): Tone {
  switch (severity) {
    case 'CRITICAL': return 'rose';
    case 'HIGH': return 'amber';
    case 'MEDIUM': return 'blue';
    default: return 'slate';
  }
}

function severityIcon(severity: string): string {
  switch (severity) {
    case 'CRITICAL': return 'priority_high';
    case 'HIGH': return 'arrow_upward';
    case 'MEDIUM': return 'remove';
    default: return 'arrow_downward';
  }
}

/* ─── Create Issue Modal ───────────────────────────────────── */

function CreateIssueModal({ projectId, onClose }: { projectId: string; onClose: () => void }) {
  const create = useCreateIssue(projectId);
  const wf = useWorkflow(projectId);
  const toast = useToast();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<string>(ISSUE_CATEGORIES[0]);
  const [severity, setSeverity] = useState<string>('MEDIUM');
  const [blocksNodes, setBlocksNodes] = useState<string[]>([]);

  const submit = () =>
    create.mutate(
      { title, description: description || undefined, category, severity, blocksNodes },
      {
        onSuccess: () => { toast.notify('Issue created.', 'success'); onClose(); },
        onError: (e) => toast.notify(errorMessage(e), 'error'),
      },
    );

  return (
    <Modal open title="Raise an issue" onClose={onClose} width="max-w-xl" footer={
      <div className="flex justify-end gap-2">
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="primary" icon="report_problem" loading={create.isPending} disabled={title.length < 5} onClick={submit}>Raise issue</Button>
      </div>
    }>
      <div className="space-y-4">
        <TextInput label="Title" required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Short description of the issue…" />
        <TextAreaField label="Description" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="What happened, impact, suggested resolution…" />
        <div className="grid grid-cols-2 gap-4">
          <SelectField label="Category" required value={category} onChange={(e) => setCategory(e.target.value)}>
            {ISSUE_CATEGORIES.map((c) => <option key={c} value={c}>{humanize(c)}</option>)}
          </SelectField>
          <SelectField label="Severity" required value={severity} onChange={(e) => setSeverity(e.target.value)}>
            {ISSUE_SEVERITIES.map((s) => <option key={s} value={s}>{humanize(s)}</option>)}
          </SelectField>
        </div>
        {wf.data ? (
          <div>
            <span className="text-label-md text-on-surface-variant">Blocks workflow steps</span>
            <div className="mt-1 flex max-h-40 flex-col gap-1 overflow-y-auto rounded border border-slate-200 p-2">
              {wf.data.nodes.filter((n) => n.activationState !== 'COMPLETED' && n.activationState !== 'NOT_APPLICABLE').map((n) => (
                <label key={n.nodeCode} className="flex items-center gap-2 text-body-sm">
                  <input type="checkbox" checked={blocksNodes.includes(n.nodeCode)} onChange={(e) => setBlocksNodes(e.target.checked ? [...blocksNodes, n.nodeCode] : blocksNodes.filter((c) => c !== n.nodeCode))} className="accent-primary" />
                  <CodeTag>{n.nodeCode}</CodeTag> {n.name}
                </label>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </Modal>
  );
}

/* ─── Issue detail drawer ──────────────────────────────────── */

function IssueDrawer({ issue: i, onClose }: { issue: IssueDto; onClose: () => void }) {
  const [resolution, setResolution] = useState('');
  const resolve = useResolveIssue();
  const toast = useToast();
  const { can } = useAuth();

  const doResolve = () =>
    resolve.mutate(
      { id: i.id, resolution },
      {
        onSuccess: () => { toast.notify('Issue resolved.', 'success'); onClose(); },
        onError: (e) => toast.notify(errorMessage(e), 'error'),
      },
    );

  return (
    <Drawer open title={<div><div className="text-headline-md">{i.title}</div><div className="text-body-sm text-on-surface-variant">{humanize(i.category)} · {humanize(i.severity)} · {humanize(i.status)}</div></div>} onClose={onClose} width="w-[420px]">
      <div className="space-y-4 p-4">
        <div className="flex items-center gap-2">
          <Badge tone={severityTone(i.severity)} label={humanize(i.severity)} icon={severityIcon(i.severity)} />
          <Badge tone={isOpenIssueStatus(i.status) ? 'rose' : 'emerald'} label={humanize(i.status)} icon={isOpenIssueStatus(i.status) ? 'error' : 'check_circle'} />
          {i.overdue ? <OverdueChip /> : null}
        </div>

        {i.description ? (
          <div>
            <span className="text-label-md text-on-surface-variant">Description</span>
            <p className="mt-0.5 whitespace-pre-line text-body-md">{i.description}</p>
          </div>
        ) : null}

        <div className="grid grid-cols-2 gap-3">
          <div><span className="text-label-md text-on-surface-variant">Opened</span><div className="text-body-md">{formatDate(i.openedAt)}</div></div>
          <div><span className="text-label-md text-on-surface-variant">Age</span><div className="font-code-tabular text-body-md">{i.ageDays} {plural(i.ageDays, 'day')}</div></div>
          {i.dueAt ? <div><span className="text-label-md text-on-surface-variant">Due</span><div className="text-body-md">{formatDate(i.dueAt)}</div></div> : null}
          {i.resolvedAt ? <div><span className="text-label-md text-on-surface-variant">Resolved</span><div className="text-body-md">{formatDate(i.resolvedAt)}</div></div> : null}
        </div>

        {i.owner ? (
          <div><span className="text-label-md text-on-surface-variant">Owner</span><div className="text-body-md">{i.owner.designation} · <span className="text-outline">{i.owner.positionCode}</span></div></div>
        ) : null}

        {i.blocks.length > 0 ? (
          <div>
            <span className="text-label-md text-on-surface-variant">Blocks {plural(i.blocks.length, 'step')}</span>
            <div className="mt-1 space-y-1">
              {i.blocks.map((b) => (
                <div key={b.nodeCode} className="flex items-center gap-2 rounded bg-red-50 px-2 py-1 text-body-sm text-red-800">
                  <Icon name="block" className="text-[14px]" /> <CodeTag>{b.nodeCode}</CodeTag> {b.name}
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {i.affects.length > 0 ? (
          <div>
            <span className="text-label-md text-on-surface-variant">Affects {plural(i.affects.length, 'step')}</span>
            <div className="mt-1 space-y-1">
              {i.affects.map((a) => (
                <div key={a.nodeCode} className="flex items-center gap-2 rounded bg-amber-50 px-2 py-1 text-body-sm text-amber-800">
                  <Icon name="warning" className="text-[14px]" /> <CodeTag>{a.nodeCode}</CodeTag> {a.name}
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {i.resolution ? (
          <div className="rounded border border-emerald-200 bg-emerald-50 p-3">
            <span className="text-label-md text-emerald-800">Resolution</span>
            <p className="mt-0.5 text-body-md text-emerald-900">{i.resolution}</p>
          </div>
        ) : null}

        {/* Resolve */}
        {isOpenIssueStatus(i.status) && can('issue.manage') ? (
          <div className="border-t border-slate-100 pt-3">
            <TextAreaField label="Resolution" required value={resolution} onChange={(e) => setResolution(e.target.value)} rows={3} placeholder="Describe how the issue was resolved…" />
            <Button variant="primary" icon="check_circle" className="mt-2" loading={resolve.isPending} disabled={resolution.length < 5} onClick={doResolve}>Resolve issue</Button>
          </div>
        ) : null}
      </div>
    </Drawer>
  );
}

/* ─── Main tab ─────────────────────────────────────────────── */

export function IssuesTab({ project }: { project: ProjectDetailDto }) {
  const q = useIssues(project.id);
  const { can } = useAuth();
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  if (q.isLoading) return <SkeletonRows rows={4} />;
  if (q.isError) return <ErrorNotice error={q.error} onRetry={() => q.refetch()} />;
  const items = q.data ?? [];

  const selected = items.find((i) => i.id === selectedId) ?? null;
  const open = items.filter((i) => isOpenIssueStatus(i.status));
  const critical = open.filter((i) => i.severity === 'CRITICAL');

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex gap-4">
          <Kpi label="Open" value={open.length} icon="error" tone={open.length > 0 ? 'rose' : 'default'} />
          <Kpi label="Critical" value={critical.length} icon="priority_high" tone={critical.length > 0 ? 'rose' : 'default'} />
          <Kpi label="Closed" value={items.length - open.length} icon="check_circle" />
        </div>
        {can('issue.manage') ? (
          <Button variant="primary" icon="add_circle" onClick={() => setCreateOpen(true)}>Raise issue</Button>
        ) : null}
      </div>

      {!items.length ? (
        <EmptyState icon="report_problem" title="No issues" message="Issues are raised when site problems, inspection failures or blockers are identified." />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className={TABLE}>
            <thead className={THEAD}>
              <tr>
                <th className={TH}>Issue</th>
                <th className={TH}>Category</th>
                <th className={TH}>Severity</th>
                <th className={TH}>Status</th>
                <th className={TH}>Blocks</th>
                <th className={TH}>Age</th>
                <th className={TH} />
              </tr>
            </thead>
            <tbody>
              {items.map((i) => (
                <tr key={i.id} className={`${TR} cursor-pointer`} onClick={() => setSelectedId(i.id)}>
                  <td className={TD}><span className="font-medium">{i.title}</span></td>
                  <td className={TD}>{humanize(i.category)}</td>
                  <td className={TD}><Badge tone={severityTone(i.severity)} label={humanize(i.severity)} icon={severityIcon(i.severity)} /></td>
                  <td className={TD}>
                    <Badge tone={isOpenIssueStatus(i.status) ? 'rose' : 'emerald'} label={humanize(i.status)} />
                    {i.overdue ? <OverdueChip className="ml-1" /> : null}
                  </td>
                  <td className={TD_MONO}>{i.blocks.length || '—'}</td>
                  <td className={TD_MONO}>{i.ageDays}d</td>
                  <td className={TD}><Button size="sm" icon="open_in_new" onClick={(e) => { e.stopPropagation(); setSelectedId(i.id); }}>Details</Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {createOpen ? <CreateIssueModal projectId={project.id} onClose={() => setCreateOpen(false)} /> : null}
      {selected ? <IssueDrawer issue={selected} onClose={() => setSelectedId(null)} /> : null}
    </div>
  );
}
