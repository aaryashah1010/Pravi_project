import { useState } from 'react';
import {
  useApprovals,
  useProjectDocuments,
  useProjectTasks,
  useProjectAudit,
  useCompleteTask,
  useVerifyDocument,
} from '@/lib/queries';
import { useAuth } from '@/lib/auth';
import { useToast } from '@/components/ui/Toast';
import { errorMessage, downloadFile } from '@/lib/api';
import type { DocumentDto } from '@/lib/types';
import { Button, LinkButton } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { Modal } from '@/components/ui/Overlay';
import { TextAreaField } from '@/components/ui/Form';
import { StatusBadge, Badge, OverdueChip, ManualReviewBadge } from '@/components/ui/Badge';
import { EmptyState, ErrorNotice, SkeletonRows } from '@/components/ui/States';
import { TABLE, THEAD, TH, TR, TD, TD_MONO } from '@/components/ui/table';
import { formatDate, formatDateTime, relativeTime, formatBytes, humanize } from '@/lib/format';
import { approvalStatus, taskPriority, taskStatus, isOpenTaskStatus, auditLabel, auditIcon, docRequirementStatus } from '@/lib/labels';
import { UploadDialog } from './UploadDialog';

/* ─── Approvals ──────────────────────────────────────────────── */

export function ApprovalsTab({ projectId }: { projectId: string }) {
  const q = useApprovals({ projectId });
  if (q.isLoading) return <SkeletonRows rows={4} />;
  if (q.isError) return <ErrorNotice error={q.error} onRetry={() => q.refetch()} />;
  const items = q.data ?? [];
  if (!items.length) return <EmptyState icon="verified" title="No approvals yet" message="Approvals will appear here once the workflow generates approval gates." />;

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200">
      <table className={TABLE}>
        <thead className={THEAD}>
          <tr>
            <th className={TH}>Node</th>
            <th className={TH}>Type</th>
            <th className={TH}>Status</th>
            <th className={TH}>Authority</th>
            <th className={TH}>Age</th>
            <th className={TH} />
          </tr>
        </thead>
        <tbody>
          {items.map((a) => {
            const s = approvalStatus(a.status);
            return (
              <tr key={a.id} className={TR}>
                <td className={TD}><span className="font-medium">{a.nodeName}</span><div className="text-body-sm text-on-surface-variant">{a.nodeCode}</div></td>
                <td className={TD}>{humanize(a.approvalType)}</td>
                <td className={TD}><StatusBadge style={s} />{a.overdue ? <OverdueChip className="ml-1" /> : null}</td>
                <td className={TD}>
                  {a.authority.requiresManualReview ? <ManualReviewBadge /> : a.authority.position ? <span className="text-body-sm">{a.authority.position.designation}</span> : <span className="text-body-sm text-on-surface-variant">—</span>}
                </td>
                <td className={TD_MONO}>{a.ageDays}d</td>
                <td className={TD}><LinkButton to={`/approvals/${a.id}`} size="sm" icon="open_in_new">View</LinkButton></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ─── Documents ──────────────────────────────────────────────── */

function RejectDocumentModal({ doc, onClose }: { doc: DocumentDto | null; onClose: () => void }) {
  const verify = useVerifyDocument();
  const toast = useToast();
  const [note, setNote] = useState('');
  const tooShort = note.trim().length < 5;

  const close = () => {
    setNote('');
    onClose();
  };
  const submit = () => {
    if (!doc || tooShort) return;
    verify.mutate(
      { id: doc.id, status: 'REJECTED', note: note.trim() },
      {
        onSuccess: () => {
          toast.notify('Document rejected. The reason is recorded in the audit log.', 'success');
          close();
        },
        onError: (e) => toast.notify(errorMessage(e), 'error'),
      },
    );
  };

  return (
    <Modal
      open={!!doc}
      onClose={close}
      title="Reject document"
      footer={
        <>
          <Button variant="secondary" onClick={close}>Cancel</Button>
          <Button variant="danger" icon="cancel" disabled={tooShort} loading={verify.isPending} onClick={submit}>Reject document</Button>
        </>
      }
    >
      <p className="mb-3 text-body-md text-on-surface-variant">
        {doc ? <><span className="font-medium text-on-surface">{doc.title}</span> ({doc.documentType.name}) will be marked rejected, and any workflow step that needs it stays incomplete.</> : null}
      </p>
      <TextAreaField label="Reason (required)" required rows={4} value={note} onChange={(e) => setNote(e.target.value)} hint="Minimum 5 characters. Shown to the uploader and stored in the audit log." />
    </Modal>
  );
}

export function DocumentsTab({ projectId }: { projectId: string }) {
  const q = useProjectDocuments(projectId);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [rejecting, setRejecting] = useState<DocumentDto | null>(null);
  const { can } = useAuth();
  const verify = useVerifyDocument();
  const toast = useToast();

  if (q.isLoading) return <SkeletonRows rows={4} />;
  if (q.isError) return <ErrorNotice error={q.error} onRetry={() => q.refetch()} />;
  const docs = q.data ?? [];

  return (
    <div className="space-y-3">
      {can('document.upload') ? (
        <div className="flex justify-end">
          <Button variant="primary" icon="upload_file" onClick={() => setUploadOpen(true)}>Upload document</Button>
        </div>
      ) : null}
      <UploadDialog projectId={projectId} open={uploadOpen} onClose={() => setUploadOpen(false)} />
      <RejectDocumentModal doc={rejecting} onClose={() => setRejecting(null)} />
      {!docs.length ? (
        <EmptyState icon="folder_open" title="No documents" message="Upload project documents to proceed with approvals." />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className={TABLE}>
            <thead className={THEAD}>
              <tr>
                <th className={TH}>Title</th>
                <th className={TH}>Type</th>
                <th className={TH}>Status</th>
                <th className={TH}>Size</th>
                <th className={TH}>Uploaded</th>
                <th className={TH} />
              </tr>
            </thead>
            <tbody>
              {docs.map((d) => (
                <tr key={d.id} className={TR}>
                  <td className={TD}><span className="font-medium">{d.title}</span>{d.filename ? <div className="text-body-sm text-on-surface-variant">{d.filename}</div> : null}</td>
                  <td className={TD}>{d.documentType.name}</td>
                  <td className={TD}>
                    {d.requirementStatus ? <StatusBadge style={docRequirementStatus(d.requirementStatus)} /> : <Badge tone="slate" label="Uploaded" icon="attach_file" />}
                    {d.linkedNodes.length ? <div className="mt-0.5 text-body-sm text-on-surface-variant">For {d.linkedNodes.join(', ')}</div> : null}
                  </td>
                  <td className={TD_MONO}>{formatBytes(d.sizeBytes)}</td>
                  <td className={TD}><span className="text-body-sm">{formatDate(d.uploadedAt)}</span></td>
                  <td className={TD}>
                    <div className="flex gap-1">
                      <Button size="sm" icon="download" onClick={() => void downloadFile(`/documents/${d.id}/download`, d.filename ?? d.title).catch((e: unknown) => toast.notify(errorMessage(e), 'error'))}>Download</Button>
                      {can('document.verify') && d.requirementStatus === 'SUBMITTED' ? (
                        <>
                          <Button size="sm" variant="primary" icon="verified" loading={verify.isPending} onClick={() => verify.mutate({ id: d.id, status: 'VERIFIED' }, { onSuccess: () => toast.notify('Document verified.', 'success'), onError: (e) => toast.notify(errorMessage(e), 'error') })}>Verify</Button>
                          <Button size="sm" variant="danger" icon="cancel" onClick={() => setRejecting(d)}>Reject</Button>
                        </>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ─── Tasks ──────────────────────────────────────────────────── */

export function TasksTab({ projectId }: { projectId: string }) {
  const q = useProjectTasks(projectId);
  const complete = useCompleteTask();
  const toast = useToast();

  if (q.isLoading) return <SkeletonRows rows={4} />;
  if (q.isError) return <ErrorNotice error={q.error} onRetry={() => q.refetch()} />;
  const items = q.data ?? [];
  if (!items.length) return <EmptyState icon="assignment_turned_in" title="No tasks" message="Tasks are created when workflow steps become eligible." />;

  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200">
      <table className={TABLE}>
        <thead className={THEAD}>
          <tr>
            <th className={TH}>Task</th>
            <th className={TH}>Type</th>
            <th className={TH}>Priority</th>
            <th className={TH}>Status</th>
            <th className={TH}>Assigned to</th>
            <th className={TH}>Age</th>
            <th className={TH} />
          </tr>
        </thead>
        <tbody>
          {items.map((t) => {
            const p = taskPriority(t.priority);
            return (
              <tr key={t.id} className={TR}>
                <td className={TD}><span className="font-medium">{t.title}</span>{t.nodeCode ? <div className="text-body-sm text-on-surface-variant">{t.nodeCode}</div> : null}</td>
                <td className={TD}>{humanize(t.taskType)}</td>
                <td className={TD}><StatusBadge style={p} /></td>
                <td className={TD}><StatusBadge style={taskStatus(t.status, t.overdue)} /></td>
                <td className={TD}>{t.assignedPosition ? <span className="text-body-sm">{t.assignedPosition.designation}<br /><span className="text-on-surface-variant">{t.assignedPosition.officeName}</span></span> : <span className="text-on-surface-variant">—</span>}</td>
                <td className={TD_MONO}>{t.ageDays}d</td>
                <td className={TD}>
                  {t.canComplete && isOpenTaskStatus(t.status) ? (
                    <Button size="sm" variant="primary" icon="check" loading={complete.isPending} onClick={() => complete.mutate({ id: t.id, versionNo: t.versionNo }, { onError: (e) => toast.notify(errorMessage(e), 'error') })}>Complete</Button>
                  ) : null}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ─── Audit ──────────────────────────────────────────────────── */

export function AuditTab({ projectId }: { projectId: string }) {
  const q = useProjectAudit(projectId);
  if (q.isLoading) return <SkeletonRows rows={6} />;
  if (q.isError) return <ErrorNotice error={q.error} onRetry={() => q.refetch()} />;
  const items = q.data ?? [];
  if (!items.length) return <EmptyState icon="lock_clock" title="No audit entries" message="Activity will be recorded here as the project progresses." />;

  return (
    <div className="space-y-0.5">
      {items.map((e) => (
        <div key={e.id} className="flex items-start gap-3 rounded px-3 py-2 hover:bg-surface-container">
          <Icon name={auditIcon(e.action)} className="mt-0.5 text-[18px] text-on-surface-variant" />
          <div className="min-w-0 flex-1">
            <div className="text-body-md text-on-surface">{auditLabel(e.action)}</div>
            <div className="flex flex-wrap gap-x-3 text-body-sm text-on-surface-variant">
              {e.actorName ? <span>{e.actorName}</span> : null}
              {e.actorDesignation ? <span className="text-outline">{e.actorDesignation}</span> : null}
              <time dateTime={e.at} title={formatDateTime(e.at)}>{relativeTime(e.at)}</time>
              {e.requestId ? <span className="font-code-sm text-code-sm text-outline" title="Request ID">{e.requestId.slice(0, 8)}</span> : null}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
