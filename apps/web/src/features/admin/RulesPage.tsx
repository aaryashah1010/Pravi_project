import { useState } from 'react';
import { useRules } from '@/lib/queries';
import type { RuleDto } from '@/lib/types';
import { Page } from '@/components/shell/AppShell';
import { Card, PageHeader } from '@/components/ui/Card';
import { Badge, CodeTag, TrustBadge } from '@/components/ui/Badge';
import { Drawer } from '@/components/ui/Overlay';
import { EmptyState, ErrorNotice, InfoBanner, SkeletonRows } from '@/components/ui/States';
import { SelectField, TextInput } from '@/components/ui/Form';
import { TABLE, TD, TD_MONO, TH, THEAD, TR } from '@/components/ui/table';
import { humanize } from '@/lib/format';
import { ProvenancePanel } from './ProvenancePanel';

const CATEGORIES = ['PREREQUISITE', 'AUTHORITY', 'CLEARANCE', 'WORKFLOW', 'DOCUMENT', 'SLA', 'VARIATION', 'PROCUREMENT', 'EXECUTION', 'COMPLETION', 'OTHER'];
const VERIFICATION = ['VERIFIED', 'UNVERIFIED', 'DRAFT', 'SUPERSEDED', 'DISABLED'];

export function RulesPage() {
  const [q, setQ] = useState('');
  const [category, setCategory] = useState('');
  const [verification, setVerification] = useState('');
  const [selected, setSelected] = useState<RuleDto | null>(null);
  const rules = useRules({ q: q || undefined, category: category || undefined, verification: verification || undefined });
  const rows = rules.data ?? [];
  const counts = {
    executable: rows.filter((r) => r.executable).length,
    synthetic: rows.filter((r) => r.synthetic).length,
    advisory: rows.filter((r) => !r.executable && !r.synthetic).length,
  };

  return (
    <Page>
      <PageHeader
        title="Rule registry"
        subtitle="Every executable rule is versioned, has a stored source and citation, and is enforceable only when it is VERIFIED and inside its effective dates. AI cannot promote a rule."
      />
      <InfoBanner tone="amber" icon="science">
        Rules marked <strong>SYNTHETIC DEMO</strong> are placeholders for the demo department only. The real R&amp;B department has no verified delegation configured — approvals there require manual review.
      </InfoBanner>

      <Card>
        <div className="flex flex-wrap items-end gap-3 border-b border-slate-100 p-3">
          <TextInput label="Search" placeholder="Rule code or name" value={q} onChange={(e) => setQ(e.target.value)} wrapperClassName="w-64" />
          <SelectField label="Category" value={category} onChange={(e) => setCategory(e.target.value)} wrapperClassName="w-48">
            <option value="">All categories</option>
            {CATEGORIES.map((c) => <option key={c} value={c}>{humanize(c)}</option>)}
          </SelectField>
          <SelectField label="Verification" value={verification} onChange={(e) => setVerification(e.target.value)} wrapperClassName="w-44">
            <option value="">Any status</option>
            {VERIFICATION.map((c) => <option key={c} value={c}>{humanize(c)}</option>)}
          </SelectField>
          <div className="ml-auto flex flex-wrap gap-2 pb-1">
            <Badge tone="emerald" label={`${counts.executable} executable`} icon="gavel" />
            <Badge tone="amber" label={`${counts.synthetic} synthetic demo`} icon="science" />
            <Badge tone="slate" label={`${counts.advisory} advisory / not enforceable`} icon="info" />
          </div>
        </div>

        {rules.isLoading ? (
          <div className="p-4"><SkeletonRows rows={8} /></div>
        ) : rules.isError ? (
          <div className="p-4"><ErrorNotice error={rules.error} onRetry={() => rules.refetch()} /></div>
        ) : rows.length === 0 ? (
          <EmptyState icon="rule" title="No rules match" message="Try clearing a filter." className="py-10" />
        ) : (
          <div className="overflow-x-auto if-scroll-thin">
            <table className={TABLE}>
              <thead className={THEAD}>
                <tr>
                  <th className={TH}>Rule</th>
                  <th className={TH}>Name</th>
                  <th className={TH}>Category</th>
                  <th className={TH}>Enforcement</th>
                  <th className={TH}>Trust</th>
                  <th className={TH}>Executable</th>
                  <th className={TH}>Source</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className={`${TR} cursor-pointer`} onClick={() => setSelected(r)}>
                    <td className={TD_MONO}>{r.ruleCode}<span className="text-slate-400"> v{r.versionNo}</span></td>
                    <td className={TD}><span className="line-clamp-2 max-w-md">{r.name}</span></td>
                    <td className={TD}>{humanize(r.category)}</td>
                    <td className={TD}>{humanize(r.enforcementMode)}</td>
                    <td className={TD}><TrustBadge badge={r.trustBadge} /></td>
                    <td className={TD}>
                      {r.executable ? <Badge tone="emerald" label="Executable" icon="check_circle" /> : <Badge tone="slate" label="Not executable" icon="block" />}
                    </td>
                    <td className={TD_MONO}>{r.source.code ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Drawer
        open={!!selected}
        onClose={() => setSelected(null)}
        width="w-[440px]"
        title={
          selected ? (
            <div>
              <h2 className="text-headline-md text-slate-900">{selected.name}</h2>
              <div className="mt-1 flex flex-wrap items-center gap-1.5">
                <CodeTag>{selected.ruleCode}</CodeTag>
                <TrustBadge badge={selected.trustBadge} />
              </div>
            </div>
          ) : undefined
        }
      >
        {selected ? <div className="p-4"><ProvenancePanel ruleId={selected.id} /></div> : null}
      </Drawer>
    </Page>
  );
}
