import { Link, useNavigate } from 'react-router-dom';
import type { AttentionItemDto, DashboardSummaryDto } from '@infraflow/shared';
import { useAuth } from '@/lib/auth';
import { auditIcon, auditLabel } from '@/lib/labels';
import { formatInr, humanize, pct, plural, relativeTime } from '@/lib/format';
import { useAttention, useDashboardApprovals, useOverdue, useProjects, useRecentAudit, useSummary } from '@/lib/queries';
import { Page } from '@/components/shell/AppShell';
import { ApprovalSourceBadge, Badge, OverdueChip, TrustBadge } from '@/components/ui/Badge';
import { LinkButton } from '@/components/ui/Button';
import { Card, CardBody, CardHeader, Kpi, PageHeader } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { EmptyState, ErrorNotice, Skeleton, SkeletonRows } from '@/components/ui/States';
import { TABLE, TD, TH, THEAD, TR } from '@/components/ui/table';
import { AuthorityCell } from '@/features/approvals/ApprovalsInboxPage';

const REASON_LABEL: Record<string, string> = {
  ISSUE_BLOCKS: 'Open blocking issue',
  APPROVAL_REJECTED: 'Approval rejected',
  SLA_OVERDUE: 'Step past its configured SLA',
};

function SegmentBar({ parts }: { parts: { value: number; cls: string }[] }) {
  const total = parts.reduce((s, p) => s + p.value, 0);
  return (
    <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-surface-container-highest" aria-hidden="true">
      {total > 0 ? parts.map((p, i) => <div key={i} className={p.cls} style={{ width: `${(p.value / total) * 100}%` }} />) : null}
    </div>
  );
}

function KpiRow({ s }: { s: DashboardSummaryDto }) {
  const p = s.projects;
  return (
    <section className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-4" aria-label="Portfolio summary">
      <Kpi label="Active projects" value={p.active} sub={`${formatInr(p.totalValue)} total`} icon="folder_open">
        <div className="mb-1.5 flex items-center justify-between font-code-sm text-code-sm">
          <span className="font-semibold text-emerald-700">{p.onTrack} on track</span>
          <span className="font-semibold text-amber-700">{p.atRisk} at risk</span>
          <span className="font-semibold text-red-700">{p.blocked} blocked</span>
        </div>
        <SegmentBar
          parts={[
            { value: p.onTrack, cls: 'bg-emerald-600' },
            { value: p.atRisk, cls: 'bg-amber-500' },
            { value: p.blocked, cls: 'bg-red-600' },
          ]}
        />
      </Kpi>
      <Kpi label="Pending approvals" value={s.approvals.pending} sub={`Avg age: ${s.approvals.avgAgeDays}d`} icon="pending_actions">
        {s.approvals.byType.length === 0 ? (
          <p className="font-code-sm text-code-sm text-on-surface-variant">No approvals pending</p>
        ) : (
          <ul className="flex flex-wrap gap-x-4 gap-y-1 font-code-sm text-code-sm">
            {s.approvals.byType.slice(0, 3).map((t) => (
              <li key={t.type} className="flex flex-col">
                <span className="text-outline">{humanize(t.type)}</span>
                <span className="font-semibold text-on-surface">{plural(t.count, 'case')}</span>
              </li>
            ))}
          </ul>
        )}
      </Kpi>
      <Kpi label="Projects at risk" value={p.atRisk} sub={s.approvals.overdue > 0 ? `${s.approvals.overdue} overdue approvals` : undefined} icon="warning">
        <div className="flex items-center justify-between font-code-sm text-code-sm text-on-surface-variant">
          <span>{plural(s.tasks.overdue, 'overdue task')}</span>
          <span>{plural(s.tasks.open, 'open task')}</span>
        </div>
      </Kpi>
      <Kpi label="Blocked projects" value={p.blocked} sub={p.blocked > 0 ? 'Flagged blockers' : undefined} icon="block" tone="rose">
        <p className="flex items-center gap-2 text-body-sm font-medium leading-tight text-red-900">
          <Icon name="priority_high" className="text-[16px] text-error" />
          {s.blockedDownstream > 0 ? `Impacting ${plural(s.blockedDownstream, 'downstream step')}` : 'No downstream steps are currently held back'}
        </p>
      </Kpi>
    </section>
  );
}

function BlockerBanner({ item, others }: { item: AttentionItemDto; others: AttentionItemDto[] }) {
  const b = item.blocker;
  const p = item.project;
  const shown = b.downstream.slice(0, 6);
  return (
    <section className="overflow-hidden rounded-lg border border-red-200 bg-surface-container-lowest shadow-md" aria-label="Critical blocker">
      <div className="flex flex-wrap items-center justify-between gap-2 bg-error px-4 py-2 text-on-error">
        <span className="flex items-center gap-2 text-label-lg font-semibold uppercase tracking-wide">
          <Icon name="warning" className="text-[20px]" filled />
          Critical blocker identified
        </span>
        <span className="font-code-sm text-code-sm">{plural(item.blockerCount, 'flagged blocker')} on this project</span>
      </div>
      <div className="grid gap-4 p-4 lg:grid-cols-[1fr_auto]">
        <div className="min-w-0 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-headline-xl text-on-surface">{p.name}</h2>
            <span className="rounded-lg bg-secondary-fixed px-2 py-0.5 font-code-tabular text-code-tabular text-on-secondary-fixed-variant">{p.code}</span>
            <Badge tone="rose" label="Root blocker active" icon="block" />
          </div>
          <div className="rounded-lg border border-red-100 bg-red-50 p-3">
            <p className="text-label-md uppercase text-red-800">{REASON_LABEL[b.reason] ?? humanize(b.reason)}</p>
            <p className="mt-1 text-body-lg font-semibold text-on-surface">{b.nodeName}</p>
            <p className="mt-1 text-body-md text-red-950">{b.message}</p>
            <p className="mt-2 text-body-sm text-slate-700">
              <span className="font-semibold">To unblock:</span> {b.unblockCondition}
            </p>
            <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 font-code-tabular text-code-tabular text-slate-700">
              <span>
                Age <span className="font-semibold text-red-700">{b.ageDays}d</span> {b.slaDays !== null ? `vs ${b.slaDays}d SLA` : '(no SLA configured)'}
              </span>
              {b.overdue ? <OverdueChip>{`${b.overdueDays}d overdue`}</OverdueChip> : null}
              {b.rule ? <TrustBadge badge={b.rule.trustBadge} code={b.rule.ruleCode} /> : null}
            </p>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <p className="text-label-md uppercase text-outline">Downstream impact ({b.downstreamCount})</p>
              {shown.length === 0 ? (
                <p className="mt-1 text-body-md text-on-surface-variant">No downstream steps are held back.</p>
              ) : (
                <ul className="mt-1 flex flex-wrap gap-1.5">
                  {shown.map((d) => (
                    <li key={d.nodeCode} className="rounded-lg border border-slate-300 bg-white px-2 py-0.5 text-body-sm text-slate-800">
                      {d.name}
                    </li>
                  ))}
                  {b.downstream.length > shown.length ? <li className="px-1 py-0.5 text-body-sm text-on-surface-variant">+{b.downstream.length - shown.length} more</li> : null}
                </ul>
              )}
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <p className="text-label-md uppercase text-outline">Responsible position</p>
              {b.owner ? (
                <>
                  <p className="mt-1 text-body-md font-semibold text-on-surface">{b.owner.designation}</p>
                  <p className="text-body-md text-on-surface-variant">{b.owner.officeName}</p>
                  <p className="text-body-sm text-slate-700">{b.owner.holderName ?? 'Vacant seat'}</p>
                </>
              ) : (
                <p className="mt-1 text-body-md text-on-surface-variant">No position assigned to this step yet.</p>
              )}
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-2 lg:w-64">
          <LinkButton to={`/projects/${p.id}?tab=workflow&node=${b.nodeCode}`} variant="danger" icon="account_tree">
            View full project workflow
          </LinkButton>
          <LinkButton to={`/projects/${p.id}`} icon="folder_open">
            Open project
          </LinkButton>
        </div>
      </div>
      {others.length > 0 ? (
        <div className="border-t border-slate-100 bg-slate-50 px-4 py-2">
          <p className="mb-1 text-label-md uppercase text-outline">Also needing attention</p>
          <ul className="flex flex-wrap gap-x-6 gap-y-1">
            {others.map((o) => (
              <li key={o.project.id} className="text-body-md">
                <Link to={`/projects/${o.project.id}?tab=workflow&node=${o.blocker.nodeCode}`} className="text-secondary hover:underline">
                  <span className="font-code-sm text-code-sm">{o.project.code}</span> — {o.blocker.nodeName}
                </Link>
                <span className="ml-1 text-body-sm text-on-surface-variant">({plural(o.blocker.downstreamCount, 'downstream step')})</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

function ApprovalsTable() {
  const navigate = useNavigate();
  const q = useDashboardApprovals(6);
  return (
    <Card className="overflow-hidden">
      <CardHeader
        title="Urgent pending approvals"
        icon="fact_check"
        right={
          <>
            {q.data ? <span className="rounded bg-primary-container px-2 py-0.5 font-code-sm text-code-sm font-semibold text-on-primary">{q.data.length} shown</span> : null}
            <LinkButton to="/approvals" variant="ghost" size="sm">
              View all approvals
            </LinkButton>
          </>
        }
      />
      {q.isLoading ? (
        <SkeletonRows rows={4} />
      ) : q.isError ? (
        <div className="p-4">
          <ErrorNotice error={q.error} onRetry={() => q.refetch()} />
        </div>
      ) : q.data && q.data.length === 0 ? (
        <EmptyState icon="task_alt" title="No approvals waiting" message="Approval cases appear here when a workflow step needs a decision." />
      ) : (
        <div className="overflow-x-auto">
          <table className={TABLE}>
            <thead className={THEAD}>
              <tr>
                <th className={TH}>Project</th>
                <th className={TH}>Approval type</th>
                <th className={TH}>Authority position</th>
                <th className={TH}>Age</th>
                <th className={TH}>Source</th>
                <th className={`${TH} text-right`}>Action</th>
              </tr>
            </thead>
            <tbody>
              {q.data!.map((a) => (
                <tr key={a.id} className={`${TR} cursor-pointer ${a.overdue ? 'bg-red-50/40' : ''}`} onClick={() => navigate(`/approvals/${a.id}`)}>
                  <td className={TD}>
                    <p className="font-medium text-on-surface">{a.projectName}</p>
                    <p className="font-code-sm text-code-sm text-primary-container">{a.projectCode}</p>
                  </td>
                  <td className={TD}>
                    <p>{a.nodeName}</p>
                    <p className="text-body-sm text-on-surface-variant">{humanize(a.approvalType)}</p>
                  </td>
                  <td className={TD}>
                    <AuthorityCell a={a.authority} />
                  </td>
                  <td className={TD}>
                    <span className="font-code-tabular text-code-tabular">{a.ageDays}d</span>
                    {a.overdue ? <OverdueChip className="ml-2" /> : null}
                  </td>
                  <td className={TD}>
                    <ApprovalSourceBadge approval={a} />
                  </td>
                  <td className={`${TD} text-right`} onClick={(e) => e.stopPropagation()}>
                    <Link to={`/approvals/${a.id}`} className="inline-flex h-8 items-center rounded border border-primary-container bg-primary-container px-3 text-body-sm font-semibold text-on-primary hover:bg-secondary">
                      Review
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

function OverdueWatch() {
  const q = useOverdue(6);
  return (
    <Card>
      <CardHeader title="Overdue step SLA watch" icon="notifications_active" subtitle="Live steps past the SLA configured on the workflow template." />
      {q.isLoading ? (
        <SkeletonRows rows={3} />
      ) : q.isError ? (
        <div className="p-4">
          <ErrorNotice error={q.error} onRetry={() => q.refetch()} />
        </div>
      ) : q.data && q.data.length === 0 ? (
        <EmptyState icon="schedule" title="No steps are past their SLA" message="Steps appear here once they exceed the SLA configured for them." />
      ) : (
        <ul className="space-y-2 p-4">
          {q.data!.map((o) => (
            <li key={`${o.projectId}-${o.nodeCode}`} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border-l-4 border-l-red-600 border border-slate-200 bg-slate-50 p-3">
              <div className="min-w-0">
                <p className="text-body-md font-semibold text-on-surface">{o.nodeName}</p>
                <p className="text-body-sm text-on-surface-variant">
                  <Link to={`/projects/${o.projectId}?tab=workflow&node=${o.nodeCode}`} className="text-secondary hover:underline">
                    <span className="font-code-sm text-code-sm">{o.projectCode}</span> — {o.projectName}
                  </Link>
                </p>
                <p className="text-body-sm text-slate-700">
                  {o.ownerDesignation ?? 'No position assigned'}
                  {o.ownerHolder ? ` · ${o.ownerHolder}` : ''}
                </p>
              </div>
              <div className="text-right">
                <OverdueChip>{`${o.overdueDays}d overdue`}</OverdueChip>
                <p className="mt-1 font-code-sm text-code-sm text-on-surface-variant">
                  {o.ageDays}d elapsed{o.slaDays !== null ? ` / ${o.slaDays}d SLA` : ''}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function ProgressCard({ s }: { s: DashboardSummaryDto }) {
  const pr = s.progress;
  const fin = s.financial;
  const est = Number(fin.totalEstimated);
  const san = Number(fin.totalSanctioned);
  const coverage = est > 0 ? (san / est) * 100 : 0;
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader title="Physical execution progress" icon="engineering" subtitle="Averages across recorded construction milestones." />
        <CardBody>
          {pr.milestones === 0 ? (
            <EmptyState icon="flag" className="py-6" title="No milestone progress yet" message="Progress appears here once construction milestones are planned and reported. Planned, reported and verified values are never mixed." />
          ) : (
            <div className="space-y-3">
              {[
                { label: 'Planned', value: pr.plannedAvg, cls: 'bg-slate-400' },
                { label: 'Reported', value: pr.reportedAvg, cls: 'bg-secondary' },
                { label: 'Verified', value: pr.verifiedAvg, cls: 'bg-emerald-600' },
              ].map((r) => (
                <div key={r.label}>
                  <div className="mb-1 flex items-center justify-between text-body-sm">
                    <span className="text-slate-700">{r.label}</span>
                    <span className="font-code-tabular text-code-tabular">{pct(r.value)}</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-surface-container-highest">
                    <div className={`h-full ${r.cls}`} style={{ width: `${Math.min(100, Math.max(0, r.value))}%` }} />
                  </div>
                </div>
              ))}
              <p className="text-body-sm text-on-surface-variant">Across {plural(pr.milestones, 'milestone')}.</p>
            </div>
          )}
        </CardBody>
      </Card>
      <Card>
        <CardHeader title="Financial summary" icon="payments" subtitle="Estimated cost versus technical sanction." />
        <CardBody>
          {est === 0 ? (
            <EmptyState icon="account_balance" className="py-6" title="No cost data yet" message="Estimates appear once projects are created." />
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg bg-surface-container-low p-2 text-center">
                  <p className="text-label-md uppercase text-outline">Estimated</p>
                  <p className="font-code-tabular text-headline-md text-on-surface">{formatInr(fin.totalEstimated)}</p>
                </div>
                <div className="rounded-lg bg-surface-container-low p-2 text-center">
                  <p className="text-label-md uppercase text-outline">Sanctioned</p>
                  <p className="font-code-tabular text-headline-md text-on-surface">{formatInr(fin.totalSanctioned)}</p>
                </div>
              </div>
              <div>
                <div className="mb-1 flex items-center justify-between text-body-sm">
                  <span className="text-slate-700">Sanctioned share of estimate</span>
                  <span className="font-code-tabular text-code-tabular">{pct(coverage)}</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-surface-container-highest">
                  <div className="h-full bg-primary-container" style={{ width: `${Math.min(100, coverage)}%` }} />
                </div>
              </div>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

function ActivityFeed() {
  const q = useRecentAudit(8);
  return (
    <Card>
      <CardHeader title="Recent activity" icon="history" right={<LinkButton to="/admin/audit" variant="ghost" size="sm">Open audit log</LinkButton>} />
      {q.isLoading ? (
        <SkeletonRows rows={4} />
      ) : q.isError ? (
        <div className="p-4">
          <ErrorNotice error={q.error} onRetry={() => q.refetch()} />
        </div>
      ) : q.data && q.data.length === 0 ? (
        <EmptyState icon="history" className="py-6" title="No activity recorded yet" />
      ) : (
        <ol className="divide-y divide-slate-100">
          {q.data!.map((e) => (
            <li key={e.id} className="flex items-start gap-2 px-4 py-2.5">
              <Icon name={auditIcon(e.action)} className="mt-0.5 text-[18px] text-primary-container" />
              <div className="min-w-0 flex-1">
                <p className="text-body-md font-medium text-on-surface">{auditLabel(e.action)}</p>
                <p className="text-body-sm text-on-surface-variant">
                  {e.actorName ?? 'System'}
                  {e.actorDesignation ? ` · ${e.actorDesignation}` : ''}
                  {e.projectCode ? <span className="ml-1 font-code-sm text-code-sm">{e.projectCode}</span> : null}
                </p>
              </div>
              <span className="shrink-0 text-body-sm text-outline" title={e.at}>
                {relativeTime(e.at)}
              </span>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}

export function DashboardPage() {
  const { can } = useAuth();
  const summary = useSummary();
  const attention = useAttention(4);
  const projects = useProjects({});
  const top = attention.data?.[0];
  const noProjects = projects.data?.length === 0;

  return (
    <Page>
      <PageHeader
        title="Infrastructure Control Center"
        subtitle="Monitor project delivery, approvals, critical-path blockers and field execution across the portfolio."
        actions={
          <>
            <LinkButton to="/projects" icon="account_tree">
              All projects
            </LinkButton>
            {can('project.create') ? (
              <LinkButton to="/projects/new" variant="primary" icon="add_circle">
                New project
              </LinkButton>
            ) : null}
          </>
        }
      />

      {noProjects ? (
        <Card>
          <EmptyState
            icon="domain_add"
            title="No projects yet"
            message="Create the first project to generate its source-backed workflow, route approvals to the competent position and start monitoring blockers."
            action={
              can('project.create') ? (
                <LinkButton to="/projects/new" variant="primary" icon="add_circle">
                  Create the first project
                </LinkButton>
              ) : undefined
            }
          />
        </Card>
      ) : null}

      {summary.isLoading ? (
        <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-36" />
          ))}
        </div>
      ) : summary.isError ? (
        <ErrorNotice error={summary.error} onRetry={() => summary.refetch()} />
      ) : summary.data ? (
        <KpiRow s={summary.data} />
      ) : null}

      {attention.isLoading ? (
        <Skeleton className="h-64" />
      ) : attention.isError ? (
        <ErrorNotice error={attention.error} onRetry={() => attention.refetch()} />
      ) : top ? (
        <BlockerBanner item={top} others={attention.data!.slice(1)} />
      ) : !noProjects ? (
        <Card>
          <CardBody className="flex items-center gap-3 text-body-md text-emerald-900">
            <Icon name="check_circle" className="text-[22px] text-emerald-600" filled />
            No root blockers are flagged across the portfolio.
          </CardBody>
        </Card>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="min-w-0 space-y-4">
          <ApprovalsTable />
          <OverdueWatch />
        </div>
        <div className="min-w-0 space-y-4">
          {summary.data ? <ProgressCard s={summary.data} /> : null}
          {can('audit.read') ? <ActivityFeed /> : null}
        </div>
      </div>
    </Page>
  );
}
