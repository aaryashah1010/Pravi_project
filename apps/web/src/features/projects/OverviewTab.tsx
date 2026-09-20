import type { ProjectDetailDto } from '@infraflow/shared';
import { useWorkflow, useProjectDocuments, useProjectTasks, useContract, useIssues } from '@/lib/queries';
import { Card, CardHeader, CardBody, Kpi } from '@/components/ui/Card';
import { InfoBanner, Skeleton } from '@/components/ui/States';
import { formatInr, formatDate, humanize, pct } from '@/lib/format';
import { POSSESSION_LABEL, isOpenIssueStatus, isOpenTaskStatus } from '@/lib/labels';
import { FactsCard, LifecyclePipeline, RootBlockerCard } from './OverviewPanels';

interface Props {
  project: ProjectDetailDto;
}

function SiteCard({ project: p }: { project: ProjectDetailDto }) {
  const s = p.site;
  if (!s) return null;
  const rows: [string, string | null][] = [
    ['Address', s.addressLine],
    ['City', s.city],
    ['District', s.district],
    ['Taluka', s.taluka],
    ['Land owner', s.landOwner],
    ['Possession', POSSESSION_LABEL[s.possessionStatus] ?? humanize(s.possessionStatus)],
    ['Survey', humanize(s.surveyStatus)],
    ['Soil investigation', humanize(s.soilInvestigationStatus)],
    ['Coordinates', s.latitude && s.longitude ? `${s.latitude}, ${s.longitude}` : null],
  ];
  const filled = rows.filter(([, v]) => v);
  if (!filled.length) return null;

  return (
    <Card>
      <CardHeader title="Site details" icon="location_on" />
      <CardBody>
        <dl className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
          {filled.map(([label, val]) => (
            <div key={label}>
              <dt className="text-label-md text-on-surface-variant">{label}</dt>
              <dd className="text-body-md text-on-surface">{val}</dd>
            </div>
          ))}
        </dl>
      </CardBody>
    </Card>
  );
}

function ProposalCard({ project: p }: { project: ProjectDetailDto }) {
  const pr = p.proposal;
  if (!pr) return null;
  return (
    <Card>
      <CardHeader title="Proposal" icon="description" subtitle={`Version ${pr.versionNo} · ${humanize(pr.status)}`} />
      <CardBody>
        <div className="space-y-2">
          <div>
            <span className="text-label-md text-on-surface-variant">Preliminary estimate</span>
            <div className="font-code-tabular text-body-md text-on-surface">{formatInr(pr.preliminaryEstimate)}</div>
          </div>
          <div>
            <span className="text-label-md text-on-surface-variant">Justification</span>
            <p className="mt-0.5 whitespace-pre-line text-body-md text-on-surface">{pr.justification}</p>
          </div>
        </div>
      </CardBody>
    </Card>
  );
}

function WorkflowSummaryCard({ projectId, hasWorkflow }: { projectId: string; hasWorkflow: boolean }) {
  const wf = useWorkflow(projectId, hasWorkflow);
  if (!hasWorkflow) return null;
  if (wf.isLoading) return <Skeleton className="h-32 w-full" />;
  if (!wf.data) return null;
  const s = wf.data.summary;

  return (
    <Card>
      <CardHeader title="Workflow progress" icon="hub" />
      <CardBody>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Kpi label="Total steps" value={s.total} icon="format_list_numbered" />
          <Kpi label="Completed" value={s.completed} icon="check_circle" tone={s.completed > 0 ? 'default' : undefined} />
          <Kpi label="Blocked" value={s.blocked} icon="block" tone={s.blocked > 0 ? 'rose' : undefined} />
          <Kpi label="Eligible" value={s.eligible + s.active} icon="play_circle" />
        </div>
        {s.total > 0 ? (
          <div className="mt-3">
            <div className="flex h-2.5 overflow-hidden rounded-full bg-slate-200">
              <div className="bg-emerald-500 transition-all" style={{ width: pct(s.completed / s.total) }} />
              <div className="bg-blue-500 transition-all" style={{ width: pct((s.eligible + s.active) / s.total) }} />
              <div className="bg-red-400 transition-all" style={{ width: pct(s.blocked / s.total) }} />
            </div>
            <div className="mt-1 flex gap-4 text-body-sm text-on-surface-variant">
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500" /> Completed</span>
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-blue-500" /> In progress</span>
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-red-400" /> Blocked</span>
              <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-slate-200" /> Waiting</span>
            </div>
          </div>
        ) : null}
      </CardBody>
    </Card>
  );
}

export function OverviewTab({ project: p }: Props) {
  const docs = useProjectDocuments(p.id);
  const tasks = useProjectTasks(p.id);
  const contract = useContract(p.id);
  const issues = useIssues(p.id);
  const openTasks = tasks.data?.filter((t) => isOpenTaskStatus(t.status)).length;
  const openIssues = issues.data?.filter((i) => isOpenIssueStatus(i.status)).length;

  return (
    <div className="space-y-4">
      {p.isDemo ? (
        <InfoBanner tone="blue" icon="science">
          This is a <strong>synthetic demo project</strong> seeded with backdated history for demonstration purposes. All data is artificial.
        </InfoBanner>
      ) : null}

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi label="Estimated cost" value={formatInr(p.estimatedCost)} icon="currency_rupee" />
        <Kpi label="Open tasks" value={openTasks ?? '—'} icon="assignment_turned_in" />
        <Kpi label="Documents" value={docs.data?.length ?? '—'} icon="folder_special" />
        <Kpi label="Open issues" value={openIssues ?? '—'} icon="report_problem" tone={(openIssues ?? 0) > 0 ? 'rose' : 'default'} />
      </div>

      <LifecyclePipeline stage={p.lifecycleStage} />

      <RootBlockerCard project={p} />

      <WorkflowSummaryCard projectId={p.id} hasWorkflow={p.hasWorkflow} />

      <FactsCard project={p} />

      {/* Contract summary if available */}
      {contract.data ? (
        <Card>
          <CardHeader title="Contract" icon="handshake" subtitle={`${contract.data.contractor.name} · ${contract.data.contractNumber}`} />
          <CardBody>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div><span className="text-label-md text-on-surface-variant">Awarded value</span><div className="font-code-tabular text-body-md">{formatInr(contract.data.awardedValue)}</div></div>
              <div><span className="text-label-md text-on-surface-variant">Contract date</span><div className="text-body-md">{formatDate(contract.data.contractDate)}</div></div>
              <div><span className="text-label-md text-on-surface-variant">Start date</span><div className="text-body-md">{formatDate(contract.data.startDate)}</div></div>
              <div><span className="text-label-md text-on-surface-variant">Completion date</span><div className="text-body-md">{formatDate(contract.data.completionDate)}</div></div>
            </div>
            {contract.data.workOrder ? (
              <div className="mt-2 text-body-sm text-on-surface-variant">
                Work order: <span className="font-code-sm">{contract.data.workOrder.number}</span> · {humanize(contract.data.workOrder.status)}
              </div>
            ) : null}
          </CardBody>
        </Card>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <SiteCard project={p} />
        <ProposalCard project={p} />
      </div>

      {/* Project metadata */}
      <Card>
        <CardHeader title="Project details" icon="info" />
        <CardBody>
          <dl className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
            <div><dt className="text-label-md text-on-surface-variant">Project type</dt><dd className="text-body-md">{p.projectType.name}</dd></div>
            <div><dt className="text-label-md text-on-surface-variant">Department</dt><dd className="text-body-md">{p.departmentName}</dd></div>
            <div><dt className="text-label-md text-on-surface-variant">Owning office</dt><dd className="text-body-md">{p.owningOfficeName}</dd></div>
            {p.jurisdictionName ? <div><dt className="text-label-md text-on-surface-variant">Jurisdiction</dt><dd className="text-body-md">{p.jurisdictionName}</dd></div> : null}
            <div><dt className="text-label-md text-on-surface-variant">Created by</dt><dd className="text-body-md">{p.createdBy.name}</dd></div>
            <div><dt className="text-label-md text-on-surface-variant">Created</dt><dd className="text-body-md">{formatDate(p.createdAt)}</dd></div>
          </dl>
        </CardBody>
      </Card>
    </div>
  );
}
