import { useState } from 'react';
import { useAuditFeed, useProjects } from '@/lib/queries';
import { Page } from '@/components/shell/AppShell';
import { PageHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { CodeTag, Badge } from '@/components/ui/Badge';
import { EmptyState, ErrorNotice, SkeletonRows } from '@/components/ui/States';
import { SelectField } from '@/components/ui/Form';
import { formatDateTime, relativeTime, humanize } from '@/lib/format';
import { auditLabel, auditIcon } from '@/lib/labels';

export function AuditPage() {
  const [projectId, setProjectId] = useState('');
  const [action, setAction] = useState('');
  const projects = useProjects({});
  const feed = useAuditFeed({ projectId: projectId || undefined, action: action || undefined });

  const items = feed.data?.pages.flat() ?? [];

  return (
    <Page>
      <PageHeader title="Audit Log" subtitle="Immutable, append-only record of all system actions" />

      <div className="flex flex-wrap gap-3">
        <SelectField label="Project" value={projectId} onChange={(e) => setProjectId(e.target.value)} wrapperClassName="w-80">
          <option value="">All projects</option>
          {(projects.data ?? []).map((p) => <option key={p.id} value={p.id}>{p.code} — {p.name}</option>)}
        </SelectField>
        <SelectField label="Activity" value={action} onChange={(e) => setAction(e.target.value)} wrapperClassName="w-64">
          <option value="">All activity</option>
          <option value="auth.">Sign-ins</option>
          <option value="project.">Project changes</option>
          <option value="workflow.">Workflow generation</option>
          <option value="approval">Approvals</option>
          <option value="document.">Documents</option>
          <option value="task">Tasks</option>
          <option value="inspection.">Inspections</option>
          <option value="milestone.">Milestones</option>
          <option value="issue.">Issues</option>
          <option value="ai.">Copilot</option>
        </SelectField>
      </div>

      {feed.isLoading ? <SkeletonRows rows={10} /> : feed.isError ? <ErrorNotice error={feed.error} onRetry={() => feed.refetch()} /> : !items.length ? (
        <EmptyState icon="lock_clock" title="No audit entries" message="Audit events will appear here as users interact with the system." />
      ) : (
        <div className="space-y-px">
          {items.map((e) => (
            <div key={e.id} className="flex items-start gap-3 rounded px-3 py-2.5 transition-colors hover:bg-surface-container">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-container">
                <Icon name={auditIcon(e.action)} className="text-[16px] text-secondary" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-label-lg text-on-surface">{auditLabel(e.action)}</span>
                  {e.projectCode ? <CodeTag>{e.projectCode}</CodeTag> : null}
                </div>
                <div className="flex flex-wrap gap-x-3 text-body-sm text-on-surface-variant">
                  {e.actorName ? <span>{e.actorName}</span> : null}
                  {e.actorDesignation ? <span className="text-outline">{e.actorDesignation}</span> : null}
                  {e.actorRole ? <Badge tone="slate" label={humanize(e.actorRole)} /> : null}
                </div>
                <div className="mt-0.5 flex gap-3 text-body-sm text-outline">
                  <time dateTime={e.at} title={formatDateTime(e.at)}>{relativeTime(e.at)}</time>
                  {e.requestId ? <span className="font-code-sm text-code-sm" title="Request ID">{e.requestId.slice(0, 8)}</span> : null}
                  {e.entityType && e.entityId ? <span className="font-code-sm text-code-sm">{e.entityType}:{e.entityId.slice(0, 8)}</span> : null}
                </div>
              </div>
            </div>
          ))}
          {feed.hasNextPage ? (
            <div className="flex justify-center py-4">
              <Button variant="secondary" icon="expand_more" loading={feed.isFetchingNextPage} onClick={() => feed.fetchNextPage()}>Load more</Button>
            </div>
          ) : (
            <div className="py-4 text-center text-body-sm text-on-surface-variant">{items.length} entries shown</div>
          )}
        </div>
      )}
    </Page>
  );
}
