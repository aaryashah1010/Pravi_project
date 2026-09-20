import type { ProjectDetailDto, MilestoneDto, ContractDto } from '@infraflow/shared';
import { useMilestones, useContract, useReportProgress } from '@/lib/queries';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/components/ui/Toast';
import { errorMessage } from '@/lib/api';
import { Card, CardHeader, CardBody, Kpi } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge, CodeTag } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Overlay';
import { EmptyState, ErrorNotice, InfoBanner, SkeletonRows } from '@/components/ui/States';
import { useState } from 'react';
import { formatDate, formatInr, humanize, plural } from '@/lib/format';

/* ─── Progress bar ──────────────────────────────────────────── */

function ProgressBar({ planned, reported, verified }: { planned: number; reported: number; verified: number }) {
  return (
    <div className="space-y-1">
      <div className="relative h-3 overflow-hidden rounded-full bg-slate-200">
        <div className="absolute inset-y-0 left-0 rounded-full bg-slate-300 transition-all" style={{ width: `${planned}%` }} title={`Planned: ${planned}%`} />
        <div className="absolute inset-y-0 left-0 rounded-full bg-blue-400/60 transition-all" style={{ width: `${reported}%` }} title={`Reported: ${reported}%`} />
        <div className="absolute inset-y-0 left-0 rounded-full bg-emerald-500 transition-all" style={{ width: `${verified}%` }} title={`Verified: ${verified}%`} />
      </div>
      <div className="flex gap-4 text-body-sm text-on-surface-variant">
        <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-slate-300" /> Planned {planned}%</span>
        <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-blue-400" /> Reported {reported}%</span>
        <span className="flex items-center gap-1"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Verified {verified}%</span>
      </div>
    </div>
  );
}

/* ─── Report progress modal ────────────────────────────────── */

function ReportProgressModal({ milestone, onClose }: { milestone: MilestoneDto; onClose: () => void }) {
  const [progress, setProgress] = useState(milestone.reportedProgress);
  const [narrative, setNarrative] = useState('');
  const report = useReportProgress();
  const toast = useToast();

  const submit = () =>
    report.mutate(
      { id: milestone.id, reportedProgress: progress, narrative: narrative || undefined },
      {
        onSuccess: () => { toast.notify('Progress reported.', 'success'); onClose(); },
        onError: (e) => toast.notify(errorMessage(e), 'error'),
      },
    );

  return (
    <Modal open title={`Report progress — ${milestone.name}`} onClose={onClose} footer={
      <div className="flex justify-end gap-2">
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="primary" icon="send" loading={report.isPending} onClick={submit}>Submit</Button>
      </div>
    }>
      <div className="space-y-4">
        <div>
          <label htmlFor="report-progress" className="text-label-md text-on-surface-variant">Progress (%)</label>
          <input id="report-progress" type="range" min={0} max={100} value={progress} onChange={(e) => setProgress(Number(e.target.value))} className="mt-1 w-full accent-primary" />
          <div className="text-center font-code-tabular text-headline-lg text-primary">{progress}%</div>
        </div>
        <div>
          <label htmlFor="report-narrative" className="text-label-md text-on-surface-variant">Narrative (optional)</label>
          <textarea id="report-narrative" rows={3} value={narrative} onChange={(e) => setNarrative(e.target.value)} className="mt-1 w-full rounded border border-slate-300 px-3 py-2 text-body-md" placeholder="Describe work completed..." />
        </div>
        <InfoBanner tone="amber" icon="info">
          Reported progress is advisory only. Verified progress comes from inspector assessments and is never taken from the contractor.
        </InfoBanner>
      </div>
    </Modal>
  );
}

/* ─── Milestone card ───────────────────────────────────────── */

function MilestoneCard({ m, canReport }: { m: MilestoneDto; canReport: boolean }) {
  const [reportOpen, setReportOpen] = useState(false);
  const variance = m.variance;
  const varianceTone: 'emerald' | 'amber' | 'rose' = variance >= 0 ? 'emerald' : variance >= -10 ? 'amber' : 'rose';

  return (
    <Card>
      <CardHeader
        title={<span className="flex items-center gap-2"><CodeTag>{m.code}</CodeTag> {m.name}</span>}
        icon="flag"
        subtitle={`Sequence ${m.sequenceNo ?? '—'} · ${humanize(m.status)}`}
        right={
          <div className="flex items-center gap-2">
            {m.openBlockingIssues > 0 ? (
              <Badge tone="rose" label={`${m.openBlockingIssues} blocking ${plural(m.openBlockingIssues, 'issue')}`} icon="report_problem" />
            ) : null}
            {canReport && m.status !== 'COMPLETED' ? (
              <Button size="sm" icon="trending_up" onClick={() => setReportOpen(true)}>Report progress</Button>
            ) : null}
          </div>
        }
      />
      <CardBody>
        <ProgressBar planned={m.plannedProgress} reported={m.reportedProgress} verified={m.verifiedProgress} />
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div><span className="text-label-md text-on-surface-variant">Planned start</span><div className="text-body-md">{formatDate(m.plannedStart) || '—'}</div></div>
          <div><span className="text-label-md text-on-surface-variant">Planned finish</span><div className="text-body-md">{formatDate(m.plannedFinish) || '—'}</div></div>
          <div><span className="text-label-md text-on-surface-variant">Actual start</span><div className="text-body-md">{formatDate(m.actualStart) || '—'}</div></div>
          <div><span className="text-label-md text-on-surface-variant">Actual finish</span><div className="text-body-md">{formatDate(m.actualFinish) || '—'}</div></div>
        </div>
        <div className="mt-3 flex gap-4">
          <Kpi label="Inspections" value={m.inspectionCounts.total} icon="fact_check" />
          <Kpi label="Passed" value={m.inspectionCounts.pass} icon="check_circle" />
          <Kpi label="Failed" value={m.inspectionCounts.fail} icon="cancel" tone={m.inspectionCounts.fail > 0 ? 'rose' : 'default'} />
        </div>
        {variance !== 0 ? (
          <div className="mt-2 text-body-sm">
            <Badge tone={varianceTone} label={`Variance: ${variance > 0 ? '+' : ''}${variance} pp`} icon={variance >= 0 ? 'trending_up' : 'trending_down'} />
          </div>
        ) : null}
        {m.lastUpdate ? (
          <div className="mt-2 rounded bg-surface-container px-3 py-2 text-body-sm">
            <span className="text-on-surface-variant">Last update:</span> {m.lastUpdate.reportedProgress}% by {m.lastUpdate.by} · {formatDate(m.lastUpdate.at)}
            {m.lastUpdate.narrative ? <div className="mt-0.5 text-on-surface">{m.lastUpdate.narrative}</div> : null}
          </div>
        ) : null}
      </CardBody>
      {reportOpen ? <ReportProgressModal milestone={m} onClose={() => setReportOpen(false)} /> : null}
    </Card>
  );
}

/* ─── Contract card ────────────────────────────────────────── */

function ContractCard({ c }: { c: ContractDto }) {
  return (
    <Card>
      <CardHeader title="Contract details" icon="handshake" subtitle={c.contractNumber} />
      <CardBody>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div><span className="text-label-md text-on-surface-variant">Contractor</span><div className="text-body-md font-medium">{c.contractor.name}</div><div className="text-body-sm text-outline">{c.contractor.code}</div></div>
          <div><span className="text-label-md text-on-surface-variant">Awarded value</span><div className="font-code-tabular text-body-md">{formatInr(c.awardedValue)}</div></div>
          <div><span className="text-label-md text-on-surface-variant">Status</span><div className="text-body-md">{humanize(c.status)}</div></div>
          <div><span className="text-label-md text-on-surface-variant">Contract date</span><div className="text-body-md">{formatDate(c.contractDate)}</div></div>
          <div><span className="text-label-md text-on-surface-variant">Start date</span><div className="text-body-md">{formatDate(c.startDate)}</div></div>
          <div><span className="text-label-md text-on-surface-variant">Completion date</span><div className="text-body-md">{formatDate(c.completionDate)}</div></div>
        </div>
        {c.workOrder ? (
          <div className="mt-3 rounded border border-outline-variant/40 bg-surface-container-lowest p-3">
            <span className="text-label-md text-on-surface-variant">Work order</span>
            <div className="mt-1 text-body-md"><span className="font-code-sm">{c.workOrder.number}</span> · {humanize(c.workOrder.status)} · Issued {formatDate(c.workOrder.issueDate)}</div>
          </div>
        ) : null}
        {c.dlpStartDate ? (
          <div className="mt-2 text-body-sm text-on-surface-variant">
            DLP: {formatDate(c.dlpStartDate)} — {formatDate(c.dlpEndDate)}
          </div>
        ) : null}
      </CardBody>
    </Card>
  );
}

/* ─── Main tab ────────────────────────────────────────────── */

export function ConstructionTab({ project }: { project: ProjectDetailDto }) {
  const milestones = useMilestones(project.id);
  const contract = useContract(project.id);
  const { can } = useAuth();
  const canReport = can('milestone.update', 'contractor.submit_progress');

  if (milestones.isLoading) return <SkeletonRows rows={4} />;
  if (milestones.isError) return <ErrorNotice error={milestones.error} onRetry={() => milestones.refetch()} />;

  const items = milestones.data ?? [];
  const overallPlanned = items.length ? Math.round(items.reduce((a, m) => a + m.plannedProgress, 0) / items.length) : 0;
  const overallVerified = items.length ? Math.round(items.reduce((a, m) => a + m.verifiedProgress, 0) / items.length) : 0;
  const overallReported = items.length ? Math.round(items.reduce((a, m) => a + m.reportedProgress, 0) / items.length) : 0;

  return (
    <div className="space-y-4">
      {contract.data ? <ContractCard c={contract.data} /> : null}

      {items.length ? (
        <Card>
          <CardHeader title="Overall progress" icon="analytics" />
          <CardBody>
            <ProgressBar planned={overallPlanned} reported={overallReported} verified={overallVerified} />
            <div className="mt-2 flex gap-4">
              <Kpi label="Milestones" value={items.length} icon="flag" />
              <Kpi label="Completed" value={items.filter((m) => m.status === 'COMPLETED').length} icon="check_circle" />
            </div>
          </CardBody>
        </Card>
      ) : null}

      {!items.length ? (
        <EmptyState icon="precision_manufacturing" title="No milestones" message="Construction milestones will appear after the workflow generates construction-phase steps." />
      ) : (
        [...items].sort((a, b) => (a.sequenceNo ?? 0) - (b.sequenceNo ?? 0)).map((m) => <MilestoneCard key={m.id} m={m} canReport={canReport} />)
      )}
    </div>
  );
}
