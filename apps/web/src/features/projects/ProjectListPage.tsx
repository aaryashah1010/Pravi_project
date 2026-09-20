import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { projectStatus } from '@/lib/labels';
import { formatInr, humanize } from '@/lib/format';
import { useProjects } from '@/lib/queries';
import { Page } from '@/components/shell/AppShell';
import { Badge, StatusBadge } from '@/components/ui/Badge';
import { LinkButton } from '@/components/ui/Button';
import { Card, PageHeader } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { EmptyState, ErrorNotice, SkeletonRows } from '@/components/ui/States';
import { TABLE, TD, TD_MONO, TH, THEAD, TR } from '@/components/ui/table';
import { inputClass } from '@/components/ui/Form';
import clsx from 'clsx';

const STATUS_CHIPS = [
  { value: '', label: 'All' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'AT_RISK', label: 'At risk' },
  { value: 'BLOCKED', label: 'Blocked' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'ON_HOLD', label: 'On hold' },
];

export function ProjectListPage() {
  const { can } = useAuth();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const status = params.get('status') ?? '';
  const urlQ = params.get('q') ?? '';
  const [text, setText] = useState(urlQ);

  // Keep the box in sync when the top-bar search navigates here with a new ?q=.
  useEffect(() => setText(urlQ), [urlQ]);

  useEffect(() => {
    const t = setTimeout(() => {
      if (text.trim() === urlQ) return;
      const next = new URLSearchParams(params);
      if (text.trim()) next.set('q', text.trim());
      else next.delete('q');
      setParams(next, { replace: true });
    }, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  const q = useProjects({ status: status || undefined, q: urlQ || undefined });

  const setStatus = (v: string) => {
    const next = new URLSearchParams(params);
    if (v) next.set('status', v);
    else next.delete('status');
    setParams(next, { replace: true });
  };

  const filtered = !!(status || urlQ);

  return (
    <Page>
      <PageHeader
        title="Projects"
        subtitle="Government building projects and their workflow status."
        actions={
          can('project.create') ? (
            <LinkButton to="/projects/new" variant="primary" icon="add_circle">
              New project
            </LinkButton>
          ) : undefined
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-md">
          <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-outline" />
          <input
            type="search"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Search by project code or name"
            aria-label="Search projects"
            className={clsx(inputClass, 'h-9 pl-9')}
          />
        </div>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by status">
          {STATUS_CHIPS.map((c) => {
            const active = status === c.value;
            return (
              <button
                key={c.value || 'all'}
                type="button"
                aria-pressed={active}
                onClick={() => setStatus(c.value)}
                className={clsx(
                  'h-8 rounded-lg border px-3 text-body-sm font-medium transition-colors',
                  active ? 'border-primary-container bg-primary-container text-on-primary' : 'border-slate-300 bg-white text-slate-700 hover:border-slate-400 hover:bg-slate-50',
                )}
              >
                {c.label}
              </button>
            );
          })}
        </div>
      </div>

      <Card className="overflow-hidden">
        {q.isLoading ? (
          <SkeletonRows rows={6} />
        ) : q.isError ? (
          <div className="p-4">
            <ErrorNotice error={q.error} onRetry={() => q.refetch()} />
          </div>
        ) : q.data && q.data.length === 0 ? (
          filtered ? (
            <EmptyState icon="search_off" title="No projects match" message="Try a different search term or clear the status filter." action={<button type="button" className="text-body-md font-medium text-secondary hover:underline" onClick={() => { setText(''); setParams({}, { replace: true }); }}>Clear filters</button>} />
          ) : (
            <EmptyState
              icon="domain_add"
              title="No projects yet"
              message="Create the first project to generate its workflow and start routing approvals."
              action={can('project.create') ? <LinkButton to="/projects/new" variant="primary" icon="add_circle">Create the first project</LinkButton> : undefined}
            />
          )
        ) : (
          <div className="overflow-x-auto">
            <table className={TABLE}>
              <thead className={THEAD}>
                <tr>
                  <th className={TH}>Code</th>
                  <th className={TH}>Project</th>
                  <th className={TH}>Department</th>
                  <th className={TH}>Stage</th>
                  <th className={TH}>Status</th>
                  <th className={`${TH} text-right`}>Estimated cost</th>
                  <th className={`${TH} text-right`}>Approvals</th>
                  <th className={`${TH} text-right`}>Tasks</th>
                </tr>
              </thead>
              <tbody>
                {q.data!.map((p) => (
                  <tr key={p.id} className={`${TR} cursor-pointer`} onClick={() => navigate(`/projects/${p.id}`)}>
                    <td className={`${TD_MONO} text-primary-container`}>{p.code}</td>
                    <td className={TD}>
                      <p className="font-medium text-on-surface">{p.name}</p>
                      <p className="text-body-sm text-on-surface-variant">{p.owningOfficeName}{p.jurisdictionName ? ` · ${p.jurisdictionName}` : ''}</p>
                    </td>
                    <td className={TD}>{p.departmentName}</td>
                    <td className={TD}>
                      {p.hasWorkflow ? humanize(p.lifecycleStage) : <Badge tone="slate" icon="edit_note" label="Draft — not submitted" plain />}
                    </td>
                    <td className={TD}>
                      <StatusBadge style={projectStatus(p.operationalStatus)} />
                    </td>
                    <td className={`${TD_MONO} text-right`}>{formatInr(p.estimatedCost)}</td>
                    <td className={`${TD_MONO} text-right`}>{p.openApprovalCount}</td>
                    <td className={`${TD_MONO} text-right`}>{p.openTaskCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      {q.data && q.data.length > 0 ? <p className="text-body-sm text-on-surface-variant">{q.data.length} project{q.data.length === 1 ? "" : "s"} shown.</p> : null}
    </Page>
  );
}
