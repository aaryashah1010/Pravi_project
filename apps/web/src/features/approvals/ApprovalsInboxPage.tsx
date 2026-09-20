import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { ApprovalDto } from '@infraflow/shared';
import { useApprovals } from '@/lib/queries';
import { approvalStatus } from '@/lib/labels';
import { formatDate, humanize } from '@/lib/format';
import { Page } from '@/components/shell/AppShell';
import { ApprovalSourceBadge, Badge, OverdueChip, StatusBadge } from '@/components/ui/Badge';
import { Card, PageHeader } from '@/components/ui/Card';
import { SelectField } from '@/components/ui/Form';
import { EmptyState, ErrorNotice, SkeletonRows } from '@/components/ui/States';
import { TABLE, TD, TH, THEAD, TR } from '@/components/ui/table';

const STATUS_OPTIONS = [
  { value: 'open', label: 'Open (pending, in review, returned)' },
  { value: 'IN_REVIEW', label: 'In review' },
  { value: 'PENDING', label: 'Pending submission' },
  { value: 'RETURNED', label: 'Returned' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'all', label: 'All statuses' },
];

export function DocsCell({ docs }: { docs: ApprovalDto['requiredDocuments'] }) {
  const required = docs.filter((d) => d.required);
  if (required.length === 0) return <span className="text-on-surface-variant">None required</span>;
  const missing = required.filter((d) => d.status === 'MISSING' || d.status === 'REJECTED').length;
  return missing > 0 ? (
    <Badge tone="amber" icon="error" label={`${missing} of ${required.length} missing`} plain />
  ) : (
    <Badge tone="emerald" icon="check_circle" label={`${required.length} of ${required.length} present`} plain />
  );
}

export function AuthorityCell({ a }: { a: ApprovalDto['authority'] }) {
  if (a.requiresManualReview && !a.position) {
    return <span className="text-body-md font-medium text-red-700">Unresolved — manual review</span>;
  }
  if (!a.position) return <span className="text-on-surface-variant">Not resolved</span>;
  return (
    <div className="min-w-0">
      <p className="text-body-md font-medium text-on-surface">{a.position.designation}</p>
      <p className="text-body-sm text-on-surface-variant">{a.position.officeName}</p>
      <p className="text-body-sm text-slate-700">{a.position.holder ? a.position.holder.displayName : <span className="text-amber-700">Vacant seat</span>}</p>
    </div>
  );
}

export function ApprovalsInboxPage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState('open');
  const [mine, setMine] = useState(false);
  const q = useApprovals({ status: status === 'all' ? undefined : status, mine });

  return (
    <Page>
      <PageHeader title="Approvals" subtitle="Approval cases routed to a position by the authority resolver. Cases without a verified competent authority require manual review." />

      <div className="flex flex-wrap items-end gap-3">
        <SelectField label="Status" value={status} onChange={(e) => setStatus(e.target.value)} wrapperClassName="w-72">
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </SelectField>
        <label className="mb-2 inline-flex items-center gap-2 text-body-md text-slate-800">
          <input type="checkbox" checked={mine} onChange={(e) => setMine(e.target.checked)} className="h-4 w-4 rounded border-slate-400 accent-primary-container" />
          Assigned to my position
        </label>
      </div>

      <Card className="overflow-hidden">
        {q.isLoading ? (
          <SkeletonRows rows={6} />
        ) : q.isError ? (
          <div className="p-4">
            <ErrorNotice error={q.error} onRetry={() => q.refetch()} />
          </div>
        ) : q.data && q.data.length === 0 ? (
          <EmptyState icon="verified" title="No approvals to show" message={mine ? 'Nothing is currently assigned to your position.' : 'No approval cases match this filter. Approvals appear when a workflow step that needs a decision becomes eligible.'} />
        ) : (
          <div className="overflow-x-auto">
            <table className={TABLE}>
              <thead className={THEAD}>
                <tr>
                  <th className={TH}>Approval</th>
                  <th className={TH}>Status</th>
                  <th className={TH}>Authority / position</th>
                  <th className={TH}>Submitted</th>
                  <th className={TH}>Age</th>
                  <th className={TH}>Documents</th>
                  <th className={TH}>Source</th>
                  <th className={`${TH} text-right`}>Action</th>
                </tr>
              </thead>
              <tbody>
                {q.data!.map((a) => (
                  <tr key={a.id} className={`${TR} cursor-pointer`} onClick={() => navigate(`/approvals/${a.id}`)}>
                    <td className={TD}>
                      <p className="font-medium text-on-surface">{a.nodeName}</p>
                      <p className="text-body-sm text-on-surface-variant">{humanize(a.approvalType)}</p>
                      <p className="text-body-sm">
                        <span className="font-code-sm text-code-sm text-primary-container">{a.projectCode}</span> <span className="text-on-surface-variant">{a.projectName}</span>
                      </p>
                    </td>
                    <td className={TD}>
                      <StatusBadge style={approvalStatus(a.status)} />
                    </td>
                    <td className={TD}>
                      <AuthorityCell a={a.authority} />
                    </td>
                    <td className={TD}>{a.submittedAt ? formatDate(a.submittedAt) : <span className="text-on-surface-variant">Not submitted</span>}</td>
                    <td className={TD}>
                      <span className="font-code-tabular text-code-tabular">{a.ageDays}d</span>
                      {a.overdue ? <OverdueChip className="ml-2" /> : null}
                    </td>
                    <td className={TD}>
                      <DocsCell docs={a.requiredDocuments} />
                    </td>
                    <td className={TD}>
                      <ApprovalSourceBadge approval={a} />
                    </td>
                    <td className={`${TD} text-right`} onClick={(e) => e.stopPropagation()}>
                      <Link to={`/approvals/${a.id}`} className="inline-flex h-8 items-center rounded border border-primary-container bg-primary-container px-3 text-body-sm font-semibold text-on-primary hover:bg-secondary">
                        {a.canDecide ? 'Review' : 'Open'}
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <p className="text-body-sm text-on-surface-variant">Showing up to 200 most recent cases.</p>
    </Page>
  );
}
