import { useState } from 'react';
import { useOrgTree } from '@/lib/queries';
import { Page } from '@/components/shell/AppShell';
import { PageHeader } from '@/components/ui/Card';
import { Icon } from '@/components/ui/Icon';
import { Badge, CodeTag } from '@/components/ui/Badge';
import { ErrorNotice, SkeletonRows } from '@/components/ui/States';
import type { OrgTreeOffice } from '@/lib/types';
import { humanize } from '@/lib/format';

function PositionRow({ p }: { p: OrgTreeOffice['positions'][0] }) {
  return (
    <div className="flex items-center gap-2 rounded bg-surface-container-lowest px-3 py-1.5 text-body-sm">
      <Icon name="person" className="text-[14px] text-outline" />
      <CodeTag>{p.code}</CodeTag>
      <span className="font-medium">{p.designation}</span>
      {p.displayName ? <span className="text-on-surface-variant">({p.displayName})</span> : null}
      {p.holder ? (
        <Badge tone="emerald" label={p.holder.displayName} icon="badge" />
      ) : (
        <Badge tone="amber" label="Vacant" icon="person_off" />
      )}
      <Badge tone="slate" label={humanize(p.status)} />
    </div>
  );
}

function OfficeNode({ office, depth = 0 }: { office: OrgTreeOffice; depth?: number }) {
  const [expanded, setExpanded] = useState(depth < 2);
  const hasChildren = office.children.length > 0 || office.positions.length > 0;

  return (
    <div className={depth > 0 ? 'ml-4 border-l border-outline-variant/30 pl-3' : ''}>
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left hover:bg-surface-container"
      >
        {hasChildren ? (
          <Icon name={expanded ? 'expand_more' : 'chevron_right'} className="text-[16px] text-outline" />
        ) : (
          <span className="w-4" />
        )}
        <Icon name="business" className="text-[18px] text-secondary" />
        <span className="text-label-lg">{office.name}</span>
        <CodeTag>{office.code}</CodeTag>
        <Badge tone="slate" label={humanize(office.officeType)} />
        {office.positions.length > 0 ? (
          <span className="text-body-sm text-on-surface-variant">{office.positions.length} positions</span>
        ) : null}
      </button>
      {expanded ? (
        <div className="mt-1 space-y-1">
          {office.jurisdictions.length > 0 ? (
            <div className="ml-6 flex flex-wrap gap-1">
              {office.jurisdictions.map((j) => (
                <Badge key={j.code} tone="navy" label={`${j.name} (${j.type})`} icon="location_on" />
              ))}
            </div>
          ) : null}
          {office.positions.map((p) => (
            <div key={p.id} className="ml-6">
              <PositionRow p={p} />
            </div>
          ))}
          {office.children.map((c) => (
            <OfficeNode key={c.id} office={c} depth={depth + 1} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function OrgPage() {
  const q = useOrgTree();

  return (
    <Page>
      <PageHeader title="Organization & Positions" subtitle="Hierarchical organization structure with positions, holders, and jurisdictions" />
      {q.isLoading ? <SkeletonRows rows={8} /> : q.isError ? <ErrorNotice error={q.error} onRetry={() => q.refetch()} /> : (
        <div className="space-y-4">
          {(q.data ?? []).map((org) => (
            <div key={org.id} className="rounded-lg border border-outline-variant/40 bg-white p-4">
              <div className="flex items-center gap-2">
                <Icon name="corporate_fare" className="text-[24px] text-primary" />
                <h2 className="text-headline-md text-on-surface">{org.name}</h2>
                <CodeTag>{org.code}</CodeTag>
                <Badge tone="navy" label={humanize(org.type)} />
              </div>
              <div className="mt-3 space-y-1">
                {org.offices.map((o) => <OfficeNode key={o.id} office={o} />)}
              </div>
            </div>
          ))}
        </div>
      )}
    </Page>
  );
}
