import clsx from 'clsx';
import { useState, type ReactNode } from 'react';
import type { BlockersDto, WorkflowDto, WorkflowNodeDto } from '@infraflow/shared';
import { Drawer } from '@/components/ui/Overlay';
import { Icon } from '@/components/ui/Icon';
import { Button, LinkButton } from '@/components/ui/Button';
import { GateBadge, StatusBadge, CodeTag, Badge } from '@/components/ui/Badge';
import { InfoBanner } from '@/components/ui/States';
import { TONE, docRequirementStatus, nodeState } from '@/lib/labels';
import { days, formatDate, humanize } from '@/lib/format';
import { useAuth } from '@/lib/auth';
import { ProvenancePanel } from '@/features/admin/ProvenancePanel';
import { UploadDialog } from '@/features/projects/UploadDialog';
import { directNeighbours, reach, rootCauses } from './graph';

function Section({ title, icon, children }: { title: string; icon?: string; children: ReactNode }) {
  return (
    <section className="border-b border-slate-100 px-4 py-3 last:border-b-0">
      <h3 className="mb-2 flex items-center gap-1.5 text-label-md uppercase tracking-wider text-outline">
        {icon ? <Icon name={icon} className="text-[15px]" /> : null}
        {title}
      </h3>
      {children}
    </section>
  );
}

/** A clickable neighbouring step: the way to walk up (prerequisites) or down (unlocks) the branch. */
function StepLink({ node, onSelect, note }: { node: WorkflowNodeDto; onSelect: (code: string) => void; note?: string }) {
  const st = nodeState(node.activationState, node.overdue);
  return (
    <button
      type="button"
      onClick={() => onSelect(node.nodeCode)}
      className="flex w-full items-center gap-2 rounded border border-slate-200 bg-white px-2 py-1.5 text-left hover:border-secondary hover:bg-slate-50"
    >
      <span className={clsx('h-6 w-1 shrink-0 rounded', TONE[st.tone].rail)} aria-hidden="true" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-body-md font-medium text-slate-900">{node.name}</span>
        <span className="flex items-center gap-1 text-body-sm text-slate-500">
          <Icon name={st.icon} className={clsx('text-[13px]', TONE[st.tone].soft)} filled />
          {st.label}
          {note ? <span className="text-slate-400">· {note}</span> : null}
        </span>
      </span>
      <Icon name="chevron_right" className="text-[18px] text-slate-400" />
    </button>
  );
}

interface Props {
  node: WorkflowNodeDto;
  wf: WorkflowDto;
  blockers: BlockersDto | undefined;
  projectId: string;
  onClose: () => void;
  onSelect: (code: string) => void;
}

export function NodeDrawer({ node, wf, blockers, projectId, onClose, onSelect }: Props) {
  const { can } = useAuth();
  const [uploadOpen, setUploadOpen] = useState(false);
  const st = nodeState(node.activationState, node.overdue);
  const blocker = blockers?.blockers.find((b) => b.nodeCode === node.nodeCode);
  const up = directNeighbours(node.nodeCode, wf, 'up');
  const down = directNeighbours(node.nodeCode, wf, 'down');
  const totalDown = reach(node.nodeCode, wf.edges, 'down').length;
  const done = ['COMPLETED', 'NOT_APPLICABLE', 'SKIPPED'].includes(node.activationState);
  const causes = done ? [] : rootCauses(node.nodeCode, wf).filter((c) => c.nodeCode !== node.nodeCode);
  const missing = node.requiredDocuments.filter((d) => d.status === 'MISSING' || d.status === 'REJECTED');

  return (
    <>
      <Drawer
        mode="inline"
        open
        onClose={onClose}
        width="w-[400px]"
        title={
          <div>
            <h2 className="text-headline-md text-slate-900">{node.name}</h2>
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              <CodeTag>{node.nodeCode}</CodeTag>
              <StatusBadge style={st} />
            </div>
          </div>
        }
      >
        {blocker ? (
          <Section title="Blocker diagnostic" icon="report">
            <div className="rounded-lg border border-red-200 bg-red-50 p-3">
              <p className="text-body-md font-semibold text-red-900">{blocker.message}</p>
              <p className="mt-1.5 text-body-sm text-red-900/90">
                Waiting {days(blocker.ageDays)}
                {blocker.slaDays != null ? ` against a configured SLA of ${blocker.slaDays}d` : ''}
                {blocker.overdue ? ` (${blocker.overdueDays}d over)` : ''}.
              </p>
              {blocker.issues.length ? (
                <ul className="mt-2 space-y-1 text-body-sm text-red-900">
                  {blocker.issues.map((i) => (
                    <li key={i.id} className="flex items-start gap-1.5">
                      <Icon name="report_problem" className="mt-px text-[14px]" />
                      <span>{i.title} <span className="text-red-700/80">({i.severity.toLowerCase()}, {days(i.ageDays)})</span></span>
                    </li>
                  ))}
                </ul>
              ) : null}
              <div className="mt-2 border-t border-red-200 pt-2 text-body-sm text-red-950">
                <span className="text-label-md uppercase text-red-800">To unblock</span>
                <p className="mt-0.5">{blocker.unblockCondition}</p>
              </div>
            </div>
            <p className="mt-2 text-body-sm text-slate-600">
              Holding back {blocker.downstreamCount} step{blocker.downstreamCount === 1 ? '' : 's'}:
            </p>
            <div className="mt-1 flex flex-wrap gap-1">
              {blocker.downstream.map((d) => (
                <button key={d.nodeCode} type="button" onClick={() => onSelect(d.nodeCode)} className="rounded border border-red-200 bg-white px-1.5 py-0.5 text-body-sm text-red-800 hover:bg-red-50">
                  {d.name}
                </button>
              ))}
            </div>
          </Section>
        ) : null}

        {causes.length ? (
          <Section title="Traced upward to the root cause" icon="north">
            <InfoBanner tone="amber" icon="subdirectory_arrow_left">
              This step cannot start until {causes.length === 1 ? 'this earlier step is' : 'these earlier steps are'} complete:
            </InfoBanner>
            <div className="mt-2 space-y-1.5">
              {causes.map((c) => (
                <StepLink key={c.nodeCode} node={c} onSelect={onSelect} note={c.ageDays != null ? days(c.ageDays) + (c.slaDays != null ? ` / ${c.slaDays}d SLA` : '') : undefined} />
              ))}
            </div>
          </Section>
        ) : null}

        {node.conditionPending ? (
          <Section title="Manual verification required" icon="pending_actions">
            <InfoBanner tone="amber">{node.conditionPending.message}</InfoBanner>
          </Section>
        ) : null}

        <Section title="Owner and timing" icon="badge">
          {node.assignedPosition ? (
            <p className="text-body-md text-slate-900">
              {node.assignedPosition.designation}
              <span className="text-slate-500">, {node.assignedPosition.officeName}</span>
              <span className="mt-0.5 block text-body-sm text-slate-600">
                {node.assignedPosition.holder ? `Currently ${node.assignedPosition.holder.displayName}` : <Badge tone="amber" label="Vacant seat" icon="person_off" />}
              </span>
            </p>
          ) : (
            <p className="text-body-md text-slate-600">{node.approval ? 'Deciding authority not resolved.' : 'No position assigned yet.'}</p>
          )}
          <dl className="mt-2 grid grid-cols-2 gap-2 text-body-sm">
            <div>
              <dt className="text-label-md uppercase text-outline">Age</dt>
              <dd className="font-code-tabular text-code-tabular">{node.ageDays != null ? days(node.ageDays) : '—'}</dd>
            </div>
            <div>
              <dt className="text-label-md uppercase text-outline">Configured SLA</dt>
              <dd className="font-code-tabular text-code-tabular">{node.slaDays != null ? days(node.slaDays) : '—'}</dd>
            </div>
            <div>
              <dt className="text-label-md uppercase text-outline">Due</dt>
              <dd className={clsx('font-code-tabular text-code-tabular', node.overdue && 'font-semibold text-amber-700')}>{formatDate(node.dueAt)}</dd>
            </div>
            <div>
              <dt className="text-label-md uppercase text-outline">{node.completedAt ? 'Completed' : 'Type'}</dt>
              <dd className="font-code-tabular text-code-tabular">{node.completedAt ? formatDate(node.completedAt) : humanize(node.nodeType)}</dd>
            </div>
          </dl>
        </Section>

        <Section title={`Depends on (${up.length})`} icon="north">
          {up.length ? (
            <div className="space-y-1.5">
              {up.map(({ edge, node: n }) => (
                <StepLink key={edge.id} node={n} onSelect={onSelect} note={edge.originalType === 'CONDITIONAL' ? 'conditional' : edge.dependencyType === 'INFORMATIONAL' ? 'informational' : undefined} />
              ))}
            </div>
          ) : (
            <p className="text-body-sm text-slate-500">Nothing: this is where the workflow starts.</p>
          )}
        </Section>

        <Section title={`Unlocks (${down.length}${totalDown > down.length ? `, ${totalDown} in total` : ''})`} icon="south">
          {down.length ? (
            <div className="space-y-1.5">
              {down.map(({ edge, node: n }) => (
                <StepLink key={edge.id} node={n} onSelect={onSelect} note={edge.originalType === 'CONDITIONAL' ? 'conditional' : edge.dependencyType === 'INFORMATIONAL' ? 'informational' : undefined} />
              ))}
            </div>
          ) : (
            <p className="text-body-sm text-slate-500">Nothing depends on this step.</p>
          )}
        </Section>

        <Section title="Required documents" icon="folder_special">
          {node.requiredDocuments.length ? (
            <ul className="space-y-1.5">
              {node.requiredDocuments.map((d) => (
                <li key={d.documentTypeCode} className="flex items-center justify-between gap-2 text-body-md text-slate-800">
                  <span>{d.name}</span>
                  <StatusBadge style={docRequirementStatus(d.status)} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-body-sm text-slate-500">No documents are configured for this step.</p>
          )}
          {missing.length && can('document.upload') && !done ? (
            <Button size="sm" variant="secondary" icon="upload_file" className="mt-2" onClick={() => setUploadOpen(true)}>
              Upload document
            </Button>
          ) : null}
        </Section>

        {node.approval ? (
          <Section title="Approval" icon="verified">
            <p className="text-body-md text-slate-800">
              {humanize(node.approval.approvalType)} — <strong>{humanize(node.approval.status)}</strong>
            </p>
            {node.approval.requiresManualReview ? <p className="mt-1 text-body-sm text-red-700">Authority could not be resolved; manual review required.</p> : null}
            <LinkButton to={`/approvals/${node.approval.id}`} size="sm" className="mt-2" icon="open_in_new">
              Open approval
            </LinkButton>
          </Section>
        ) : null}

        <Section title="Rule provenance" icon="gavel">
          <div className="mb-2">
            <GateBadge kind={node.gateKind} />
          </div>
          {node.rule ? (
            <ProvenancePanel ruleId={node.rule.id} />
          ) : (
            <p className="text-body-sm text-slate-600">No rule is linked to this step. It is a configured prerequisite in the workflow template, not a statutory requirement.</p>
          )}
        </Section>
      </Drawer>
      <UploadDialog projectId={projectId} open={uploadOpen} onClose={() => setUploadOpen(false)} defaultNodeCode={node.nodeCode} defaultDocType={missing[0]?.documentTypeCode} />
    </>
  );
}
