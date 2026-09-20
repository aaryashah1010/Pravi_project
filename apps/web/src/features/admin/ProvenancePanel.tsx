import type { ReactNode } from 'react';
import { formatDate, humanize } from '@/lib/format';
import { useProvenance } from '@/lib/queries';
import { Badge, TrustBadge } from '@/components/ui/Badge';
import { ErrorNotice, InfoBanner, Skeleton } from '@/components/ui/States';
import { Icon } from '@/components/ui/Icon';

const NOT_VERIFIED = 'Not verified';
const PLACEHOLDER_LOCATOR = 'Citation locator to be captured';

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[110px_1fr] gap-2 py-1">
      <dt className="text-label-md uppercase text-outline">{label}</dt>
      <dd className="min-w-0 break-words text-body-md text-on-surface">{children}</dd>
    </div>
  );
}

/** Source provenance for one rule. Everything is rendered from API data; unknown values read "Not verified". */
export function ProvenancePanel({ ruleId }: { ruleId: string }) {
  const q = useProvenance(ruleId);

  if (q.isLoading) {
    return (
      <div className="space-y-2" aria-busy="true">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }
  if (q.isError) return <ErrorNotice error={q.error} onRetry={() => q.refetch()} title="Rule provenance could not be loaded" />;
  if (!q.data) return null;

  const { rule, citations, usage } = q.data;
  const verified = rule.verificationStatus === 'VERIFIED';

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <TrustBadge badge={rule.trustBadge} />
        <Badge tone={rule.executable ? 'emerald' : 'slate'} icon={rule.executable ? 'bolt' : 'block'} label={rule.executable ? 'Executable' : 'Not executable'} />
      </div>

      {rule.synthetic ? (
        <InfoBanner tone="amber" icon="science">
          <strong className="font-semibold">SYNTHETIC DEMO.</strong> Placeholder rule for the demo department only. It is not a real government rule.
        </InfoBanner>
      ) : null}
      {!verified && !rule.synthetic ? (
        <InfoBanner tone="rose" icon="gpp_maybe">
          Manual verification required. This rule is <span className="font-semibold">{humanize(rule.verificationStatus)}</span> and cannot block, route or approve on its own.
        </InfoBanner>
      ) : null}

      <div>
        <p className="font-code-tabular text-code-tabular text-on-surface-variant">{rule.ruleCode}</p>
        <p className="text-body-md font-semibold text-on-surface">{rule.name}</p>
      </div>

      <blockquote className="rounded-lg border-l-4 border-slate-300 bg-slate-50 px-3 py-2 text-body-md text-slate-800">{rule.statement ?? NOT_VERIFIED}</blockquote>
      {rule.note ? <p className="text-body-sm text-on-surface-variant">{rule.note}</p> : null}

      <dl className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white px-3">
        <Row label="Category">{humanize(rule.category)}</Row>
        <Row label="Enforcement">{humanize(rule.enforcementMode)}</Row>
        <Row label="Verification">{humanize(rule.verificationStatus)}</Row>
        <Row label="Effective">
          {formatDate(rule.effectiveFrom)}
          {rule.effectiveTo ? ` to ${formatDate(rule.effectiveTo)}` : ' onwards'}
        </Row>
      </dl>

      <div>
        <h4 className="mb-1 text-label-md uppercase text-outline">Source</h4>
        <dl className="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white px-3">
          <Row label="Document">{rule.source.title ?? NOT_VERIFIED}</Row>
          <Row label="Issued by">{rule.source.issuingAuthority ?? NOT_VERIFIED}</Row>
          <Row label="Source level">{rule.source.verificationLevel ? humanize(rule.source.verificationLevel) : NOT_VERIFIED}</Row>
          {rule.source.officialUrl ? (
            <Row label="Official link">
              <a href={rule.source.officialUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-secondary hover:underline">
                Open source document
                <Icon name="open_in_new" className="text-[14px]" />
              </a>
            </Row>
          ) : null}
          {rule.source.notes ? <Row label="Notes">{rule.source.notes}</Row> : null}
        </dl>
      </div>

      <div>
        <h4 className="mb-1 text-label-md uppercase text-outline">Citations</h4>
        <ul className="space-y-1">
          {citations.map((c, i) => {
            const placeholder = c.locator === PLACEHOLDER_LOCATOR;
            return (
              <li key={i} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-body-md">
                {placeholder ? (
                  <span className="flex items-center gap-1 text-slate-500">
                    <Icon name="pending" className="text-[16px]" />
                    {PLACEHOLDER_LOCATOR}
                  </span>
                ) : (
                  <>
                    <span className="font-code-tabular text-code-tabular text-slate-800">{c.locator}</span>
                    <span className="ml-2 text-body-sm text-on-surface-variant">
                      {humanize(c.type)}
                      {c.pageStart ? ` · p. ${c.pageStart}${c.pageEnd && c.pageEnd !== c.pageStart ? `–${c.pageEnd}` : ''}` : ''}
                    </span>
                    {c.notes ? <p className="text-body-sm text-on-surface-variant">{c.notes}</p> : null}
                  </>
                )}
              </li>
            );
          })}
        </ul>
      </div>

      {usage.workflowNodes.length > 0 || usage.authorityRules.length > 0 ? (
        <div>
          <h4 className="mb-1 text-label-md uppercase text-outline">Used by</h4>
          <ul className="flex flex-wrap gap-1.5">
            {usage.workflowNodes.map((n) => (
              <li key={`${n.templateCode}-${n.nodeCode}`} className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-0.5 text-body-sm text-slate-700" title={n.name}>
                <span className="font-code-sm text-code-sm">{n.nodeCode}</span>
              </li>
            ))}
            {usage.authorityRules.map((a) => (
              <li key={a.code} className="rounded-lg border border-amber-200 bg-amber-50 px-2 py-0.5 text-body-sm text-amber-900" title={`Authority matrix row: ${humanize(a.decisionType)}`}>
                <span className="font-code-sm text-code-sm">{a.code}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
