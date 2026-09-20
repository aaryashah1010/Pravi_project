import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { ApprovalDto, RuleBriefDto } from '@infraflow/shared';
import { useAuth } from '@/lib/auth';
import { decisionLabel, decisionTone, docRequirementStatus, TONE, approvalStatus } from '@/lib/labels';
import { formatDate, formatDateTime, formatInr, humanize, relativeTime } from '@/lib/format';
import { useManualAssign, usePositions, useSubmitApproval, type DecisionAction } from '@/lib/queries';
import { ApiError } from '@/lib/api';
import { ApprovalSourceBadge, OverdueChip, StatusBadge, SyntheticBadge, TrustBadge, Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { SelectField, TextAreaField } from '@/components/ui/Form';
import { Icon } from '@/components/ui/Icon';
import { ErrorNotice, InfoBanner } from '@/components/ui/States';
import { useToast } from '@/components/ui/Toast';
import { TD, TH, THEAD, TR, TABLE } from '@/components/ui/table';
import { ProvenancePanel } from '@/features/admin/ProvenancePanel';
import { UploadDialog } from '@/features/projects/UploadDialog';
import { DecisionModal } from './DecisionModal';

function RuleSummary({ rule, label }: { rule: RuleBriefDto; label: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-label-md uppercase text-outline">{label}</span>
        {rule.synthetic ? <SyntheticBadge /> : <TrustBadge badge={rule.trustBadge} />}
      </div>
      <p className="mt-1 font-code-tabular text-code-tabular text-on-surface-variant">{rule.ruleCode}</p>
      <p className="text-body-md font-semibold text-on-surface">{rule.name}</p>
      <p className="mt-1 text-body-md text-slate-700">{rule.statement ?? 'Not verified'}</p>
      <button type="button" onClick={() => setOpen((o) => !o)} className="mt-2 inline-flex items-center gap-1 text-body-sm font-medium text-secondary hover:underline" aria-expanded={open}>
        <Icon name={open ? 'expand_less' : 'expand_more'} className="text-[16px]" />
        {open ? 'Hide source and citations' : 'Show source and citations'}
      </button>
      {open ? (
        <div className="mt-3 border-t border-slate-100 pt-3">
          <ProvenancePanel ruleId={rule.id} />
        </div>
      ) : null}
    </div>
  );
}

function ManualAssignForm({ approval }: { approval: ApprovalDto }) {
  const positions = usePositions();
  const assign = useManualAssign();
  const { notify } = useToast();
  const [positionId, setPositionId] = useState('');
  const [reason, setReason] = useState('');
  const fieldError = (name: string) => (assign.error instanceof ApiError ? assign.error.fieldErrors.find((f) => f.field === name)?.message : undefined);
  const valid = positionId && reason.trim().length >= 10;

  return (
    <div className="rounded-lg border border-slate-300 bg-white p-3">
      <h4 className="text-label-lg font-semibold text-on-surface">Manual authority assignment</h4>
      <p className="mb-2 text-body-sm text-on-surface-variant">Record which position is competent for this approval and why. The reason is stored in the audit trail.</p>
      <div className="space-y-3">
        <SelectField label="Competent position" required value={positionId} onChange={(e) => setPositionId(e.target.value)} error={fieldError('positionId')} disabled={positions.isLoading}>
          <option value="">{positions.isLoading ? 'Loading positions…' : 'Select a position'}</option>
          {(positions.data ?? []).map((p) => (
            <option key={p.id} value={p.id}>
              {p.designation} — {p.officeName} ({p.holder ? p.holder.displayName : 'vacant seat'})
            </option>
          ))}
        </SelectField>
        <TextAreaField
          label="Reason"
          required
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          hint="Minimum 10 characters."
          error={fieldError('reason') ?? (reason.length > 0 && reason.trim().length < 10 ? 'Please record why this position is competent (min 10 characters).' : undefined)}
        />
        {assign.isError ? <ErrorNotice error={assign.error} /> : null}
        <Button
          variant="primary"
          icon="assignment_ind"
          disabled={!valid}
          loading={assign.isPending}
          onClick={() => assign.mutate({ id: approval.id, positionId, reason: reason.trim() }, { onSuccess: () => notify('Authority assigned manually.') })}
        >
          Assign position
        </Button>
      </div>
    </div>
  );
}

function AuthorityPanel({ approval }: { approval: ApprovalDto }) {
  const a = approval.authority;
  const pos = a.position;
  return (
    <Card>
      <CardHeader title="Competent authority" icon="gavel" right={<ApprovalSourceBadge approval={approval} />} />
      <CardBody className="space-y-3">
        {a.requiresManualReview ? (
          <div role="alert" className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-red-900">
            <Icon name="gpp_maybe" className="mt-0.5 text-[22px]" filled />
            <div>
              <p className="text-label-lg font-semibold">Manual review required</p>
              <p className="mt-0.5 text-body-md">{a.message}</p>
              {a.resolutionStatus ? <p className="mt-1 text-body-sm">Resolution status: <span className="font-code-sm text-code-sm">{a.resolutionStatus}</span></p> : null}
            </div>
          </div>
        ) : null}

        {pos ? (
          <div className="rounded-lg border border-slate-200 bg-white p-3">
            <p className="text-label-md uppercase text-outline">{a.requiresManualReview ? 'Position assigned manually' : 'Resolved position'}</p>
            <p className="mt-1 text-body-md font-semibold text-on-surface">{pos.designation}</p>
            <p className="text-body-md text-on-surface-variant">{pos.officeName}</p>
            <p className="mt-1 flex flex-wrap items-center gap-2 text-body-md">
              <span className="font-code-tabular text-code-tabular text-on-surface-variant">{pos.code}</span>
              {pos.holder ? (
                <span className="inline-flex items-center gap-1 text-slate-800">
                  <Icon name="person" className="text-[16px]" />
                  Current holder: <span className="font-semibold">{pos.holder.displayName}</span>
                </span>
              ) : (
                <Badge tone="amber" icon="person_off" label="Vacant seat" />
              )}
            </p>
          </div>
        ) : !a.requiresManualReview ? (
          <p className="text-body-md text-on-surface-variant">No position resolved.</p>
        ) : null}

        {a.rule ? (
          <div>
            <RuleSummary rule={a.rule} label={a.synthetic ? 'Authority rule (synthetic demo matrix)' : 'Authority rule'} />
            {a.ruleCode ? <p className="mt-1 text-body-sm text-on-surface-variant">Matrix row: <span className="font-code-sm text-code-sm">{a.ruleCode}</span></p> : null}
          </div>
        ) : !a.requiresManualReview ? (
          <p className="text-body-md text-on-surface-variant">Authority rule: Not verified</p>
        ) : null}

        {approval.canManualAssign ? <ManualAssignForm approval={approval} /> : null}
      </CardBody>
    </Card>
  );
}

function DocumentsPanel({ approval }: { approval: ApprovalDto }) {
  const { can } = useAuth();
  const [upload, setUpload] = useState<string | null>(null);
  const canUpload = can('document.upload');
  return (
    <Card>
      <CardHeader title="Required documents" icon="description" />
      {approval.requiredDocuments.length === 0 ? (
        <p className="p-4 text-body-md text-on-surface-variant">No documents are required for this step.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className={TABLE}>
            <thead className={THEAD}>
              <tr>
                <th className={TH}>Document</th>
                <th className={TH}>Status</th>
                <th className={`${TH} text-right`}>Action</th>
              </tr>
            </thead>
            <tbody>
              {approval.requiredDocuments.map((d) => {
                const missing = d.status === 'MISSING' || d.status === 'REJECTED';
                return (
                  <tr key={d.code} className={TR}>
                    <td className={TD}>
                      <span className="block font-medium">{d.name}</span>
                      <span className="font-code-sm text-code-sm text-on-surface-variant">
                        {d.code}
                        {d.required ? '' : ' · optional'}
                      </span>
                    </td>
                    <td className={TD}>
                      <StatusBadge style={docRequirementStatus(d.status)} />
                    </td>
                    <td className={`${TD} text-right`}>
                      {missing && canUpload ? (
                        <Button size="sm" icon="upload" onClick={() => setUpload(d.code)}>
                          {d.status === 'REJECTED' ? 'Upload again' : 'Upload'}
                        </Button>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <UploadDialog projectId={approval.projectId} open={upload !== null} onClose={() => setUpload(null)} defaultDocType={upload ?? undefined} defaultNodeCode={approval.nodeCode} />
    </Card>
  );
}

function HistoryPanel({ approval }: { approval: ApprovalDto }) {
  return (
    <Card>
      <CardHeader title="Decision history" icon="history" />
      <CardBody>
        {approval.decisions.length === 0 ? (
          <p className="text-body-md text-on-surface-variant">No decisions recorded yet.</p>
        ) : (
          <ol className="relative ml-2 border-l border-slate-200">
            {approval.decisions.map((d) => {
              const tone = TONE[decisionTone(d.action)];
              return (
                <li key={d.id} className="relative pb-4 pl-5 last:pb-0">
                  <span className={`absolute -left-[5px] top-1.5 h-2.5 w-2.5 rounded-full ring-2 ring-white ${tone.dot}`} />
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className={`text-label-lg font-semibold ${tone.soft}`}>{decisionLabel(d.action)}</span>
                    <span className="text-body-sm text-on-surface-variant" title={formatDateTime(d.at)}>
                      {formatDateTime(d.at)} · {relativeTime(d.at)}
                    </span>
                  </div>
                  <p className="text-body-md text-slate-800">
                    {d.actorName ?? 'System'}
                    {d.actorDesignation ? <span className="text-on-surface-variant"> · {d.actorDesignation}</span> : null}
                    {d.actorPositionCode ? <span className="ml-1 font-code-sm text-code-sm text-on-surface-variant">{d.actorPositionCode}</span> : null}
                  </p>
                  {d.reason ? <p className="mt-1 rounded-lg bg-slate-50 px-2 py-1 text-body-md text-slate-700">“{d.reason}”</p> : null}
                </li>
              );
            })}
          </ol>
        )}
      </CardBody>
    </Card>
  );
}

function ActionBar({ approval }: { approval: ApprovalDto }) {
  const submit = useSubmitApproval();
  const { notify } = useToast();
  const [action, setAction] = useState<DecisionAction | null>(null);
  const hasActions = approval.canSubmit || approval.canDecide;

  return (
    <div className="space-y-2">
      {hasActions ? (
        <div className="flex flex-wrap items-center gap-2">
          {approval.canSubmit ? (
            <Button variant="primary" icon="send" loading={submit.isPending} onClick={() => submit.mutate(approval.id, { onSuccess: () => notify('Approval submitted for review.') })}>
              {approval.status === 'RETURNED' ? 'Resubmit for review' : 'Submit for review'}
            </Button>
          ) : null}
          {approval.canDecide ? (
            <>
              <Button variant="primary" icon="verified" onClick={() => setAction('approve')}>
                Approve
              </Button>
              <Button icon="undo" onClick={() => setAction('return')}>
                Return
              </Button>
              <Button variant="danger" icon="cancel" onClick={() => setAction('reject')}>
                Reject
              </Button>
              <Button icon="help" onClick={() => setAction('request-info')}>
                Request information
              </Button>
            </>
          ) : null}
        </div>
      ) : approval.status === 'IN_REVIEW' ? (
        <InfoBanner icon="lock">This approval is in review. Only the holder of the competent position can record a decision.</InfoBanner>
      ) : ['PENDING', 'RETURNED'].includes(approval.status) && !approval.authority.requiresManualReview ? (
        <InfoBanner icon="schedule">Waiting for the project team to submit this approval for review.</InfoBanner>
      ) : null}
      {submit.isError ? <ErrorNotice error={submit.error} onRetry={() => submit.reset()} /> : null}
      <DecisionModal approvalId={approval.id} action={action} onClose={() => setAction(null)} />
    </div>
  );
}

/** Complete approval view (authority, provenance, documents, history, actions). Reused by the detail page and the drawer. */
export function ApprovalPanel({ approval, showProjectLink = true }: { approval: ApprovalDto; showProjectLink?: boolean }) {
  return (
    <div className="space-y-4">
      <Card>
        <CardBody className="space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-label-md uppercase text-outline">{humanize(approval.approvalType)}</p>
              <h2 className="text-headline-lg text-on-surface">{approval.nodeName}</h2>
              <p className="mt-0.5 text-body-md text-on-surface-variant">
                {showProjectLink ? (
                  <Link to={`/projects/${approval.projectId}`} className="text-secondary hover:underline">
                    <span className="font-code-tabular text-code-tabular">{approval.projectCode}</span> — {approval.projectName}
                  </Link>
                ) : (
                  <>
                    <span className="font-code-tabular text-code-tabular">{approval.projectCode}</span> — {approval.projectName}
                  </>
                )}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge style={approvalStatus(approval.status)} />
              {approval.overdue ? <OverdueChip /> : null}
            </div>
          </div>
          <dl className="grid grid-cols-2 gap-3 text-body-md md:grid-cols-4">
            <div>
              <dt className="text-label-md uppercase text-outline">Project cost</dt>
              <dd className="font-code-tabular text-code-tabular text-on-surface">{formatInr(approval.projectCost)}</dd>
            </div>
            <div>
              <dt className="text-label-md uppercase text-outline">Submitted</dt>
              <dd>{approval.submittedAt ? formatDateTime(approval.submittedAt) : 'Not yet submitted'}</dd>
            </div>
            <div>
              <dt className="text-label-md uppercase text-outline">Age</dt>
              <dd>{approval.ageDays}d</dd>
            </div>
            <div>
              <dt className="text-label-md uppercase text-outline">Due</dt>
              <dd className={approval.overdue ? 'font-semibold text-red-700' : ''}>{approval.dueAt ? formatDate(approval.dueAt) : '—'}</dd>
            </div>
          </dl>
          <ActionBar approval={approval} />
        </CardBody>
      </Card>

      <AuthorityPanel approval={approval} />

      {approval.nodeRule ? (
        <Card>
          <CardHeader title="Governing rule for this step" icon="policy" />
          <CardBody>
            <RuleSummary rule={approval.nodeRule} label="Step rule" />
          </CardBody>
        </Card>
      ) : null}

      <DocumentsPanel approval={approval} />
      <HistoryPanel approval={approval} />
    </div>
  );
}
