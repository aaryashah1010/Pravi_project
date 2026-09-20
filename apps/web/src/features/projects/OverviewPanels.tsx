import { useEffect, useState } from 'react';
import clsx from 'clsx';
import type { BlockersDto, ProjectDetailDto } from '@infraflow/shared';
import { useAuth } from '@/lib/auth';
import { useBlockers, useUpdateProject } from '@/lib/queries';
import { errorMessage } from '@/lib/api';
import { days, plural } from '@/lib/format';
import { GATE_KIND_LABEL, LIFECYCLE_STAGES } from '@/lib/labels';
import { Card, CardBody, CardHeader } from '@/components/ui/Card';
import { Button, LinkButton } from '@/components/ui/Button';
import { Badge, CodeTag, TrustBadge } from '@/components/ui/Badge';
import { Icon } from '@/components/ui/Icon';
import { ErrorNotice, InfoBanner, Skeleton } from '@/components/ui/States';
import { SelectField } from '@/components/ui/Form';
import { useToast } from '@/components/ui/Toast';

const wfLink = (projectId: string, nodeCode: string) => `/projects/${projectId}?tab=workflow&node=${nodeCode}`;

/* ─── Lifecycle pipeline ─────────────────────────────────────── */

export function LifecyclePipeline({ stage }: { stage: string }) {
  const idx = LIFECYCLE_STAGES.findIndex((s) => s.key === stage);
  return (
    <Card>
      <CardHeader title="Lifecycle" icon="flag" subtitle="Coarse project stage — the workflow graph holds the detailed step states" />
      <CardBody className="overflow-x-auto if-scroll-thin">
        <ol className="flex min-w-max items-start">
          {LIFECYCLE_STAGES.map((s, i) => {
            const done = idx >= 0 && i < idx;
            const current = i === idx;
            return (
              <li key={s.key} className="flex items-start">
                <div className="flex w-[84px] flex-col items-center text-center" aria-current={current ? 'step' : undefined}>
                  <span
                    className={clsx(
                      'flex h-6 w-6 items-center justify-center rounded-full border-2 text-[11px] font-semibold',
                      done && 'border-emerald-600 bg-emerald-600 text-white',
                      current && 'border-secondary bg-secondary text-white ring-4 ring-secondary/20',
                      !done && !current && 'border-slate-300 bg-white text-slate-400',
                    )}
                  >
                    {done ? <Icon name="check" className="text-[14px]" /> : i + 1}
                  </span>
                  <span className={clsx('mt-1 text-[11px] leading-tight', current ? 'font-semibold text-secondary' : done ? 'text-on-surface' : 'text-outline')}>{s.label}</span>
                  <span className="sr-only">{done ? 'completed' : current ? 'current stage' : 'upcoming'}</span>
                </div>
                {i < LIFECYCLE_STAGES.length - 1 ? <span className={clsx('mt-3 h-0.5 w-3 shrink-0', done ? 'bg-emerald-600' : 'bg-slate-200')} aria-hidden="true" /> : null}
              </li>
            );
          })}
        </ol>
      </CardBody>
    </Card>
  );
}

/* ─── Root blocker + next actions ─────────────────────────────── */

function BlockerDetail({ projectId, b }: { projectId: string; b: BlockersDto['blockers'][number] }) {
  const { can } = useAuth();
  return (
    <div className="space-y-3">
      <p className="text-body-md font-semibold text-red-900">{b.message}</p>
      <div className="flex flex-wrap items-center gap-1.5">
        <CodeTag>{b.nodeCode}</CodeTag>
        <Badge tone={b.mandatoryGate ? 'navy' : 'slate'} label={GATE_KIND_LABEL[b.gateKind]} icon={b.mandatoryGate ? 'gavel' : 'tune'} plain />
        {b.rule ? <TrustBadge badge={b.rule.trustBadge} code={b.rule.ruleCode} /> : null}
      </div>

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div>
          <dt className="text-label-md uppercase text-outline">Waiting</dt>
          <dd className="text-body-md text-on-surface">
            {days(b.ageDays)}
            {b.slaDays != null ? <span className="text-on-surface-variant"> of {b.slaDays}d SLA (configured)</span> : null}
            {b.overdue ? <span className="ml-1 font-semibold text-amber-700">· {b.overdueDays}d over</span> : null}
          </dd>
        </div>
        <div>
          <dt className="text-label-md uppercase text-outline">Holding back</dt>
          <dd className="text-body-md text-on-surface">{b.downstreamCount} {plural(b.downstreamCount, 'step')}</dd>
        </div>
        <div>
          <dt className="text-label-md uppercase text-outline">Owning position</dt>
          <dd className="text-body-md text-on-surface">
            {b.owner ? <>{b.owner.designation}<div className="text-body-sm text-on-surface-variant">{b.owner.officeName}</div></> : '—'}
          </dd>
        </div>
        <div>
          <dt className="text-label-md uppercase text-outline">Current holder</dt>
          <dd className="text-body-md text-on-surface">{b.owner ? (b.owner.holderName ?? <span className="text-amber-700">Seat vacant</span>) : '—'}</dd>
        </div>
      </dl>

      {b.issues.length ? (
        <div>
          <div className="text-label-md uppercase text-outline">Linked issues</div>
          <ul className="mt-1 space-y-1">
            {b.issues.map((i) => (
              <li key={i.id} className="flex items-center gap-2 text-body-sm">
                <Icon name="report_problem" className="text-[16px] text-red-700" />
                <span className="text-on-surface">{i.title}</span>
                <span className="text-on-surface-variant">· {i.severity.toLowerCase()} · open {days(i.ageDays)}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="rounded border border-slate-200 bg-slate-50 p-2.5 text-body-sm">
        <span className="font-semibold text-on-surface">To unblock: </span>
        <span className="text-on-surface-variant">{b.unblockCondition}</span>
      </div>

      <div className="flex flex-wrap gap-2">
        <LinkButton to={wfLink(projectId, b.nodeCode)} variant="primary" size="sm" icon="hub">Open in workflow graph</LinkButton>
        {can('ai.use') ? <LinkButton to={`/projects/${projectId}?tab=copilot`} size="sm" icon="smart_toy">Ask Copilot why</LinkButton> : null}
      </div>
    </div>
  );
}

export function RootBlockerCard({ project }: { project: ProjectDetailDto }) {
  const q = useBlockers(project.id, project.hasWorkflow);
  if (!project.hasWorkflow) return null;
  if (q.isLoading) return <Skeleton className="h-44 w-full" />;
  if (q.isError) return <ErrorNotice error={q.error} onRetry={() => q.refetch()} />;
  const d = q.data;
  if (!d) return null;
  const top = d.blockers[0];
  const others = d.blockers.slice(1);

  return (
    <>
      <Card className={top ? 'border-red-300' : 'border-emerald-300'}>
        <CardHeader
          title={top ? 'Root blocker' : 'No blockers detected'}
          icon={top ? 'report' : 'check_circle'}
          subtitle={top ? d.headline ?? 'The step currently holding back the most downstream work' : 'Nothing is overdue, rejected or held by an open issue on the critical frontier.'}
          className={top ? 'bg-red-50/60' : 'bg-emerald-50/60'}
        />
        <CardBody>
          {top ? (
            <>
              <BlockerDetail projectId={project.id} b={top} />
              {others.length ? (
                <div className="mt-4 border-t border-slate-100 pt-3">
                  <div className="text-label-md uppercase text-outline">Other blockers</div>
                  <ul className="mt-1 divide-y divide-slate-100">
                    {others.map((b) => (
                      <li key={b.nodeCode} className="flex flex-wrap items-center justify-between gap-2 py-1.5 text-body-sm">
                        <span className="text-on-surface">{b.nodeName} <span className="text-on-surface-variant">· holds back {b.downstreamCount} {plural(b.downstreamCount, 'step')}</span></span>
                        <LinkButton to={wfLink(project.id, b.nodeCode)} size="sm" icon="open_in_new">View</LinkButton>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </>
          ) : (
            <p className="text-body-md text-on-surface-variant">
              Work is waiting only on the steps below. Blockers appear here when a step is rejected, overdue against its configured SLA, or held by an open issue.
            </p>
          )}
        </CardBody>
      </Card>

      <NextActions projectId={project.id} d={d} />
    </>
  );
}

function NextActions({ projectId, d }: { projectId: string; d: BlockersDto }) {
  const frontier = d.frontier;
  const parallel = d.parallelEligible;
  if (!frontier.length && !parallel.length) return null;
  return (
    <Card>
      <CardHeader title="What happens next" icon="next_plan" subtitle="Steps waiting on someone now, and steps that can proceed in parallel" />
      <CardBody className="grid gap-4 md:grid-cols-2">
        <div>
          <div className="text-label-md uppercase text-outline">Waiting on ({frontier.length})</div>
          {frontier.length ? (
            <ul className="mt-1 divide-y divide-slate-100">
              {frontier.map((f) => (
                <li key={f.nodeCode} className="flex items-center justify-between gap-2 py-1.5">
                  <div className="min-w-0">
                    <div className="truncate text-body-md text-on-surface">{f.nodeName}</div>
                    <div className="text-body-sm text-on-surface-variant">
                      {f.ownerDesignation ?? 'No owner configured'} · {days(f.ageDays)}
                      {f.overdue ? <span className="ml-1 font-semibold text-amber-700">overdue</span> : null}
                    </div>
                  </div>
                  <LinkButton to={wfLink(projectId, f.nodeCode)} size="sm" icon="open_in_new" aria-label={`Open ${f.nodeName} in workflow`}>View</LinkButton>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 text-body-sm text-on-surface-variant">Nothing is currently gating downstream work.</p>
          )}
        </div>
        <div>
          <div className="text-label-md uppercase text-outline">Can proceed in parallel ({parallel.length})</div>
          {parallel.length ? (
            <ul className="mt-1 divide-y divide-slate-100">
              {parallel.map((p) => (
                <li key={p.nodeCode} className="flex items-center justify-between gap-2 py-1.5">
                  <div className="min-w-0">
                    <div className="truncate text-body-md text-on-surface">{p.name}</div>
                    <div className="text-body-sm text-on-surface-variant">{p.ownerDesignation ?? 'No owner configured'}</div>
                  </div>
                  <LinkButton to={wfLink(projectId, p.nodeCode)} size="sm" icon="open_in_new" aria-label={`Open ${p.name} in workflow`}>View</LinkButton>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 text-body-sm text-on-surface-variant">No other eligible steps right now.</p>
          )}
        </div>
      </CardBody>
    </Card>
  );
}

/* ─── Project facts (drives conditional workflow steps) ────────── */

type Tri = 'unknown' | 'yes' | 'no';
const FACTS: { key: string; label: string; hint: string }[] = [
  { key: 'local_body_approval_required', label: 'Local-body approval required?', hint: 'Decides whether the local-body clearance step applies.' },
  { key: 'requires_land_acquisition', label: 'Land acquisition required?', hint: 'Decides whether the land-acquisition prerequisite applies.' },
];

const toTri = (v: unknown): Tri => (v === true ? 'yes' : v === false ? 'no' : 'unknown');
const fromTri = (t: Tri): boolean | null => (t === 'yes' ? true : t === 'no' ? false : null);

export function FactsCard({ project }: { project: ProjectDetailDto }) {
  const { can } = useAuth();
  const toast = useToast();
  const update = useUpdateProject(project.id);
  const initial = (): Record<string, Tri> => Object.fromEntries(FACTS.map((f) => [f.key, toTri(project.attributes[f.key])]));
  const [draft, setDraft] = useState<Record<string, Tri>>(initial);

  useEffect(() => {
    setDraft(initial());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.versionNo]);

  const editable = can('project.update');
  const dirty = FACTS.some((f) => draft[f.key] !== toTri(project.attributes[f.key]));

  const save = () => {
    const attributes: Record<string, unknown> = {};
    for (const f of FACTS) if (draft[f.key] !== toTri(project.attributes[f.key])) attributes[f.key] = fromTri(draft[f.key]);
    update.mutate(
      { versionNo: project.versionNo, attributes },
      {
        onSuccess: () => toast.notify(project.hasWorkflow ? 'Facts saved. Conditional steps were re-evaluated.' : 'Facts saved.', 'success'),
        onError: (e) => toast.notify(errorMessage(e), 'error'),
      },
    );
  };

  return (
    <Card>
      <CardHeader
        title="Project facts"
        icon="fact_check"
        subtitle="Unknown is a valid answer — a step that depends on an unknown fact stays 'conditional, pending verification' instead of being silently skipped."
      />
      <CardBody>
        <div className="grid gap-3 sm:grid-cols-2">
          {FACTS.map((f) => (
            <SelectField
              key={f.key}
              label={f.label}
              hint={f.hint}
              value={draft[f.key]}
              disabled={!editable}
              onChange={(e) => setDraft((d) => ({ ...d, [f.key]: e.target.value as Tri }))}
            >
              <option value="unknown">Unknown / not yet verified</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </SelectField>
          ))}
        </div>
        {editable ? (
          <div className="mt-3 flex items-center justify-end gap-2">
            {dirty ? <span className="text-body-sm text-on-surface-variant">Unsaved changes</span> : null}
            <Button variant="primary" size="sm" icon="save" disabled={!dirty} loading={update.isPending} onClick={save}>Save facts</Button>
          </div>
        ) : (
          <InfoBanner tone="slate" className="mt-3">Your role can view these facts but not change them.</InfoBanner>
        )}
      </CardBody>
    </Card>
  );
}
