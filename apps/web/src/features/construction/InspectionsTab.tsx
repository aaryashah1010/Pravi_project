import type { ProjectDetailDto } from '@infraflow/shared';
import { useNavigate } from 'react-router-dom';
import { useInspections, useRequestInspection, useMilestones } from '@/lib/queries';
import { useState } from 'react';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/components/ui/Toast';
import { errorMessage } from '@/lib/api';
import { Kpi } from '@/components/ui/Card';
import { Button, LinkButton } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Overlay';
import { EmptyState, ErrorNotice, SkeletonRows } from '@/components/ui/States';
import { SelectField, TextAreaField } from '@/components/ui/Form';
import { TABLE, THEAD, TH, TR, TD, TD_MONO } from '@/components/ui/table';
import { formatDate, humanize } from '@/lib/format';
import { resultIcon, resultTone } from './InspectionDetail';

/* ─── Request Inspection Modal ─────────────────────────────── */

function RequestInspectionModal({ projectId, onClose }: { projectId: string; onClose: () => void }) {
  const milestones = useMilestones(projectId);
  const request = useRequestInspection(projectId);
  const toast = useToast();
  const [milestoneCode, setMilestoneCode] = useState('');
  const [note, setNote] = useState('');

  const submit = () =>
    request.mutate(
      { milestoneCode, note: note || undefined },
      {
        onSuccess: () => { toast.notify('Inspection requested.', 'success'); onClose(); },
        onError: (e) => toast.notify(errorMessage(e), 'error'),
      },
    );

  return (
    <Modal open title="Request inspection" onClose={onClose} footer={
      <div className="flex justify-end gap-2">
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="primary" icon="fact_check" loading={request.isPending} disabled={!milestoneCode} onClick={submit}>Request</Button>
      </div>
    }>
      <div className="space-y-4">
        <SelectField label="Milestone" required value={milestoneCode} onChange={(e) => setMilestoneCode(e.target.value)}>
          <option value="">Select a milestone…</option>
          {(milestones.data ?? []).map((m) => (
            <option key={m.code} value={m.code}>{m.code} — {m.name}</option>
          ))}
        </SelectField>
        <TextAreaField label="Note (optional)" value={note} onChange={(e) => setNote(e.target.value)} rows={3} placeholder="Any context for the inspector…" />
      </div>
    </Modal>
  );
}

/* ─── Main tab ─────────────────────────────────────────────── */

export function InspectionsTab({ project }: { project: ProjectDetailDto }) {
  const q = useInspections(project.id);
  const { can } = useAuth();
  const [requestOpen, setRequestOpen] = useState(false);
  const navigate = useNavigate();

  if (q.isLoading) return <SkeletonRows rows={4} />;
  if (q.isError) return <ErrorNotice error={q.error} onRetry={() => q.refetch()} />;
  const items = q.data ?? [];

  const counts = { total: items.length, pass: items.filter((i) => i.result === 'PASS').length, fail: items.filter((i) => i.result === 'FAIL').length, pending: items.filter((i) => i.result === 'PENDING').length };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex gap-4">
          <Kpi label="Total" value={counts.total} icon="fact_check" />
          <Kpi label="Passed" value={counts.pass} icon="check_circle" />
          <Kpi label="Failed" value={counts.fail} icon="cancel" tone={counts.fail > 0 ? 'rose' : 'default'} />
          <Kpi label="Pending" value={counts.pending} icon="schedule" />
        </div>
        {can('inspection.create', 'contractor.submit_progress') ? (
          <Button variant="primary" icon="add_task" onClick={() => setRequestOpen(true)}>Request inspection</Button>
        ) : null}
      </div>

      {!items.length ? (
        <EmptyState icon="fact_check" title="No inspections" message="Request an inspection for a construction milestone to start the quality verification process." />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className={TABLE}>
            <thead className={THEAD}>
              <tr>
                <th className={TH}>Milestone</th>
                <th className={TH}>Result</th>
                <th className={TH}>Inspector</th>
                <th className={TH}>Requested</th>
                <th className={TH}>Inspected</th>
                <th className={TH}>Items</th>
                <th className={TH} />
              </tr>
            </thead>
            <tbody>
              {items.map((i) => (
                <tr key={i.id} className={`${TR} cursor-pointer`} onClick={() => navigate(`/projects/${project.id}/inspections/${i.id}`)}>
                  <td className={TD}><span className="font-medium">{i.milestoneName ?? '—'}</span>{i.milestoneCode ? <div className="text-body-sm text-on-surface-variant">{i.milestoneCode}</div> : null}</td>
                  <td className={TD}><Badge tone={resultTone(i.result)} label={humanize(i.result)} icon={resultIcon(i.result)} /></td>
                  <td className={TD}>{i.inspector ? <span className="text-body-sm">{i.inspector.holderName ?? i.inspector.designation}</span> : <span className="text-on-surface-variant">—</span>}</td>
                  <td className={TD}>{formatDate(i.requestedAt)}</td>
                  <td className={TD}>{formatDate(i.inspectedAt) || <span className="text-on-surface-variant">Pending</span>}</td>
                  <td className={TD_MONO}>{i.checklistResults.length || '—'}</td>
                  <td className={TD}>
                    <LinkButton to={`/projects/${project.id}/inspections/${i.id}`} size="sm" variant={i.canSubmit && i.result === 'PENDING' ? 'primary' : 'secondary'} icon={i.canSubmit && i.result === 'PENDING' ? 'edit_note' : 'open_in_new'} onClick={(e) => e.stopPropagation()}>
                      {i.canSubmit && i.result === 'PENDING' ? 'Inspect' : 'Details'}
                    </LinkButton>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {requestOpen ? <RequestInspectionModal projectId={project.id} onClose={() => setRequestOpen(false)} /> : null}
    </div>
  );
}
