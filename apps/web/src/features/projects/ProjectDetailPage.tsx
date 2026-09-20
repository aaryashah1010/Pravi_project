import clsx from 'clsx';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { useProject, useSubmitProject } from '@/lib/queries';
import { Page } from '@/components/shell/AppShell';
import { Icon } from '@/components/ui/Icon';
import { Button } from '@/components/ui/Button';
import { CodeTag, StatusBadge, Badge } from '@/components/ui/Badge';
import { EmptyState, ErrorNotice, InfoBanner, SkeletonRows } from '@/components/ui/States';
import { useToast } from '@/components/ui/Toast';
import { formatInr, humanize } from '@/lib/format';
import { errorMessage } from '@/lib/api';
import { projectStatus } from '@/lib/labels';
import { OverviewTab } from './OverviewTab';
import { WorkflowTab } from '@/features/workflow/WorkflowTab';
import { ApprovalsTab, AuditTab, DocumentsTab, TasksTab } from './SimpleTabs';
import { ConstructionTab } from '@/features/construction/ConstructionTab';
import { InspectionsTab } from '@/features/construction/InspectionsTab';
import { IssuesTab } from '@/features/construction/IssuesTab';
import { CopilotTab } from '@/features/copilot/CopilotTab';

interface TabDef {
  key: string;
  label: string;
  icon: string;
  perms?: string[];
  badge?: number;
  needsWorkflow?: boolean;
}

export function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [sp, setSp] = useSearchParams();
  const q = useProject(id);
  const { can } = useAuth();
  const submit = useSubmitProject();
  const toast = useToast();
  const requestedTab = sp.get('tab') ?? 'overview';
  const p = q.data;

  const setTab = (key: string) =>
    setSp(
      (prev) => {
        const n = new URLSearchParams(prev);
        n.set('tab', key);
        if (key !== 'workflow') n.delete('node');
        return n;
      },
      { replace: false },
    );

  if (q.isLoading) return <Page><SkeletonRows rows={8} /></Page>;
  if (q.isError) return <Page><ErrorNotice error={q.error} onRetry={() => q.refetch()} /></Page>;
  if (!p) return <Page><EmptyState icon="search_off" title="Project not found" /></Page>;

  const tabs: TabDef[] = [
    { key: 'overview', label: 'Overview', icon: 'dashboard' },
    { key: 'workflow', label: 'Workflow', icon: 'hub', needsWorkflow: true },
    { key: 'approvals', label: 'Approvals', icon: 'verified', perms: ['approval.review', 'approval.decide'], badge: p.openApprovalCount, needsWorkflow: true },
    { key: 'documents', label: 'Documents', icon: 'folder_special' },
    { key: 'tasks', label: 'Tasks', icon: 'assignment_turned_in', badge: p.openTaskCount },
    { key: 'construction', label: 'Construction', icon: 'precision_manufacturing', needsWorkflow: true },
    { key: 'inspections', label: 'Inspections', icon: 'fact_check', needsWorkflow: true },
    { key: 'issues', label: 'Issues', icon: 'report_problem', needsWorkflow: true },
    { key: 'audit', label: 'Audit', icon: 'lock_clock', perms: ['audit.read'] },
    { key: 'copilot', label: 'Copilot', icon: 'smart_toy', perms: ['ai.use'], needsWorkflow: true },
  ];
  const visible = tabs.filter((t) => !t.perms || can(...t.perms));
  const tab = visible.some((t) => t.key === requestedTab) ? requestedTab : 'overview';
  const status = projectStatus(p.operationalStatus);

  const notSubmitted = (
    <InfoBanner tone="amber" icon="pending_actions">
      This project has not been submitted yet, so no workflow, approvals or blockers exist. Submitting evaluates the verified rules against the project facts and generates the workflow.
    </InfoBanner>
  );

  const body = () => {
    if (tab !== 'overview' && tab !== 'documents' && tab !== 'tasks' && tab !== 'audit' && !p.hasWorkflow) {
      return (
        <div className="space-y-3">
          {notSubmitted}
          {can('project.update') ? (
            <Button variant="primary" icon="rocket_launch" loading={submit.isPending} onClick={() => doSubmit()}>Submit for workflow generation</Button>
          ) : null}
        </div>
      );
    }
    switch (tab) {
      case 'workflow': return <WorkflowTab project={p} />;
      case 'approvals': return <ApprovalsTab projectId={p.id} />;
      case 'documents': return <DocumentsTab projectId={p.id} />;
      case 'tasks': return <TasksTab projectId={p.id} />;
      case 'construction': return <ConstructionTab project={p} />;
      case 'inspections': return <InspectionsTab project={p} />;
      case 'issues': return <IssuesTab project={p} />;
      case 'audit': return <AuditTab projectId={p.id} />;
      case 'copilot': return <CopilotTab project={p} />;
      default: return <OverviewTab project={p} />;
    }
  };

  function doSubmit() {
    submit.mutate(p!.id, {
      onSuccess: () => {
        toast.notify('Workflow generated from the verified rules.', 'success');
        setTab('workflow');
      },
      onError: (e) => toast.notify(errorMessage(e), 'error'),
    });
  }

  return (
    <Page>
      <nav className="flex items-center gap-1 text-body-sm text-on-surface-variant" aria-label="Breadcrumb">
        <Link to="/projects" className="text-secondary hover:underline">Projects</Link>
        <Icon name="chevron_right" className="text-[16px]" />
        <CodeTag>{p.code}</CodeTag>
      </nav>

      <header className="rounded-lg border border-outline-variant/60 bg-surface-container-lowest p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <CodeTag className="rounded bg-surface-container px-2 py-0.5 font-bold text-primary">{p.code}</CodeTag>
              <StatusBadge style={status} />
              <Badge tone="navy" label={humanize(p.lifecycleStage)} icon="flag" plain />
              {!p.hasWorkflow ? <Badge tone="amber" label="Not submitted" icon="edit_note" plain /> : null}
            </div>
            <h1 className="mt-1.5 text-headline-xl text-on-surface">{p.name}</h1>
            <p className="mt-0.5 text-body-md text-on-surface-variant">
              {p.departmentName} · {p.owningOfficeName}
              {p.jurisdictionName ? ` · ${p.jurisdictionName}` : ''}
              {p.site?.taluka ? ` · ${p.site.taluka}` : ''}
            </p>
          </div>
          <div className="text-right">
            <div className="text-label-md uppercase text-outline">Estimated cost</div>
            <div className="font-code-tabular text-headline-lg text-primary">{formatInr(p.estimatedCost)}</div>
            {!p.hasWorkflow && can('project.update') ? (
              <Button variant="primary" size="sm" icon="rocket_launch" className="mt-2" loading={submit.isPending} onClick={doSubmit}>Submit project</Button>
            ) : null}
          </div>
        </div>

        <div className="-mb-4 mt-4 flex gap-0.5 overflow-x-auto border-t border-slate-100 pt-1 if-scroll-thin" role="tablist" aria-label="Project sections">
          {visible.map((t) => {
            const active = tab === t.key;
            const dim = t.needsWorkflow && !p.hasWorkflow;
            return (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setTab(t.key)}
                className={clsx(
                  'relative flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-t px-3 py-2.5 text-label-lg transition-colors',
                  active ? 'text-secondary' : 'text-on-surface-variant hover:bg-surface-container hover:text-on-surface',
                  dim && !active && 'opacity-60',
                )}
              >
                <Icon name={t.icon} className="text-[17px]" />
                {t.label}
                {t.badge ? <span className="rounded-full bg-secondary px-1.5 font-code-sm text-code-sm font-semibold text-on-secondary">{t.badge}</span> : null}
                {active ? <span className="absolute inset-x-2 bottom-0 h-0.5 rounded bg-secondary" aria-hidden="true" /> : null}
              </button>
            );
          })}
        </div>
      </header>

      <div className="pt-4">{body()}</div>
    </Page>
  );
}
