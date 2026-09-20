import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMyTasks, useCompleteTask } from '@/lib/queries';
import { useToast } from '@/components/ui/Toast';
import { errorMessage } from '@/lib/api';
import { Page } from '@/components/shell/AppShell';
import { PageHeader, Kpi } from '@/components/ui/Card';
import { Button, LinkButton } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { StatusBadge, CodeTag } from '@/components/ui/Badge';
import { EmptyState, ErrorNotice, SkeletonRows } from '@/components/ui/States';
import { TABLE, THEAD, TH, TR, TD, TD_MONO } from '@/components/ui/table';
import { formatDate, plural } from '@/lib/format';
import { taskPriority, taskStatus, taskTypeLabel, isOpenTaskStatus } from '@/lib/labels';

type Filter = 'all' | 'open' | 'done';

export function TasksPage() {
  const q = useMyTasks();
  const complete = useCompleteTask();
  const toast = useToast();
  const [filter, setFilter] = useState<Filter>('open');

  const all = q.data ?? [];
  const open = all.filter((t) => isOpenTaskStatus(t.status));
  const overdue = open.filter((t) => t.overdue);
  const filtered = filter === 'all' ? all : all.filter((t) => (filter === 'open') === isOpenTaskStatus(t.status));

  return (
    <Page>
      <PageHeader
        title="My Tasks"
        subtitle="Action items assigned to your position or seat"
        actions={
          <div className="flex gap-2">
            {(['open', 'done', 'all'] as Filter[]).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className={`rounded-full border px-3 py-1 text-label-md transition-colors ${filter === f ? 'border-secondary bg-secondary text-white' : 'border-slate-300 bg-white text-on-surface-variant hover:bg-slate-50'}`}
              >
                {f === 'all' ? 'All' : f === 'open' ? 'Open' : 'Completed'}
              </button>
            ))}
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi label="Open" value={open.length} icon="assignment_turned_in" />
        <Kpi label="Overdue" value={overdue.length} icon="schedule" tone={overdue.length > 0 ? 'rose' : undefined} />
        <Kpi label="Closed" value={all.length - open.length} icon="check_circle" />
        <Kpi label="Total" value={all.length} icon="list_alt" />
      </div>

      {q.isLoading ? <SkeletonRows rows={6} /> : q.isError ? <ErrorNotice error={q.error} onRetry={() => q.refetch()} /> : !filtered.length ? (
        <EmptyState icon="assignment_turned_in" title={filter === 'open' ? 'No open tasks' : 'No tasks found'} message="Tasks are created when workflow steps become eligible and your position is responsible." />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className={TABLE}>
            <thead className={THEAD}>
              <tr>
                <th className={TH}>Task</th>
                <th className={TH}>Project</th>
                <th className={TH}>Type</th>
                <th className={TH}>Priority</th>
                <th className={TH}>Status</th>
                <th className={TH}>Due</th>
                <th className={TH}>Age</th>
                <th className={TH} />
              </tr>
            </thead>
            <tbody>
              {filtered.map((t) => {
                const p = taskPriority(t.priority);
                return (
                  <tr key={t.id} className={TR}>
                    <td className={TD}>
                      <span className="font-medium">{t.title}</span>
                      {t.nodeCode ? <div className="text-body-sm text-on-surface-variant">{t.nodeCode}</div> : null}
                    </td>
                    <td className={TD}>
                      <Link to={`/projects/${t.projectId}`} className="text-secondary hover:underline">
                        <CodeTag>{t.projectCode}</CodeTag>
                      </Link>
                      <div className="max-w-[180px] truncate text-body-sm text-on-surface-variant">{t.projectName}</div>
                    </td>
                    <td className={TD}>{taskTypeLabel(t.taskType)}</td>
                    <td className={TD}><StatusBadge style={p} /></td>
                    <td className={TD}>
                      <StatusBadge style={taskStatus(t.status, t.overdue)} />
                      {t.vacantSeat ? <div className="mt-0.5 text-body-sm text-amber-700">Seat vacant</div> : t.viaSeat ? <div className="mt-0.5 text-body-sm text-on-surface-variant">Via seat</div> : null}
                    </td>
                    <td className={TD}>{t.dueAt ? formatDate(t.dueAt) : '—'}</td>
                    <td className={TD_MONO}>{t.ageDays}d</td>
                    <td className={TD}>
                      <div className="flex gap-1">
                        <LinkButton to={`/projects/${t.projectId}?tab=workflow${t.nodeCode ? `&node=${t.nodeCode}` : ''}`} size="sm" icon="open_in_new">View</LinkButton>
                        {t.canComplete && isOpenTaskStatus(t.status) ? (
                          <Button
                            size="sm"
                            variant="primary"
                            icon="check"
                            loading={complete.isPending}
                            onClick={() => complete.mutate({ id: t.id, versionNo: t.versionNo }, { onError: (e) => toast.notify(errorMessage(e), 'error') })}
                          >
                            Complete
                          </Button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {overdue.length > 0 && filter !== 'done' ? (
        <div className="mt-2 text-body-sm text-on-surface-variant">
          <Icon name="info" className="mr-1 align-[-2px] text-[14px]" />
          {overdue.length} {plural(overdue.length, 'task')} overdue — tasks assigned to positions, not people (seat-based routing).
        </div>
      ) : null}
    </Page>
  );
}
