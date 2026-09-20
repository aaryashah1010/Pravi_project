import clsx from 'clsx';
import type { ApprovalDto, GateKind, TrustBadge as TrustBadgeKey } from '@infraflow/shared';
import { GATE_KIND_ICON, GATE_KIND_LABEL, TONE, trustStyle, type StatusStyle, type Tone } from '@/lib/labels';
import { Icon } from './Icon';

interface BadgeProps {
  tone: Tone;
  label: string;
  icon?: string;
  /** Optional monospace rule/code suffix, e.g. a rule code. */
  code?: string;
  outline?: boolean;
  /** Uppercase 11px label per the design system; long sentences can opt out. */
  plain?: boolean;
  title?: string;
  className?: string;
}

/** Status badge anatomy: 6px dot + label + optional mono code. Never colour-only: the dot is paired with a label (and an optional icon). */
export function Badge({ tone, label, icon, code, outline, plain, title, className }: BadgeProps) {
  const t = TONE[tone];
  return (
    <span
      title={title}
      className={clsx(
        'inline-flex max-w-full items-center gap-1.5 rounded-lg border px-1.5 py-0.5 align-middle',
        outline ? 'bg-white' : t.bg,
        t.border,
        t.text,
        className,
      )}
    >
      {icon ? <Icon name={icon} className="text-[13px]" filled /> : <span className={clsx('h-1.5 w-1.5 shrink-0 rounded-full', t.dot)} />}
      <span className={clsx('text-label-md', plain ? 'normal-case tracking-normal' : 'uppercase')}>{label}</span>
      {code ? <span className="font-code-sm text-code-sm normal-case opacity-80">{code}</span> : null}
    </span>
  );
}

export function StatusBadge({ style, code, className }: { style: StatusStyle; code?: string; className?: string }) {
  return <Badge tone={style.tone} label={style.label} icon={style.icon} code={code} className={className} />;
}

/** Trust badge mapping for rules. SYNTHETIC_DEMO is always amber and never renders as a verified source. */
export function TrustBadge({ badge, code, className }: { badge: TrustBadgeKey; code?: string; className?: string }) {
  const s = trustStyle(badge);
  return <Badge tone={s.tone} label={s.label} icon={s.icon} outline={s.outline} code={code} className={className} plain={badge === 'NOT_VERIFIED'} />;
}

export function GateBadge({ kind, className }: { kind: GateKind; className?: string }) {
  const tone: Tone = kind === 'RULE_BACKED' ? 'emerald' : kind === 'ADVISORY' || kind === 'CONDITIONAL_PENDING' ? 'amber' : 'slate';
  return <Badge tone={tone} label={GATE_KIND_LABEL[kind]} icon={GATE_KIND_ICON[kind]} plain className={className} />;
}

export function SyntheticBadge({ className }: { className?: string }) {
  return <Badge tone="amber" label="Synthetic demo" icon="science" className={className} />;
}

export function OverdueChip({ children, className }: { children?: string; className?: string }) {
  return <Badge tone="rose" label={children ?? 'Overdue'} icon="schedule" className={className} />;
}

export function ManualReviewBadge({ className }: { className?: string }) {
  return <Badge tone="rose" label="Manual review required" icon="gpp_maybe" outline className={className} />;
}

/** "Source" of an approval's authority: manual review, synthetic demo matrix, or the verified rule behind it. */
export function ApprovalSourceBadge({ approval, className }: { approval: Pick<ApprovalDto, 'authority' | 'nodeRule'>; className?: string }) {
  const a = approval.authority;
  if (a.requiresManualReview) return <ManualReviewBadge className={className} />;
  if (a.synthetic) return <SyntheticBadge className={className} />;
  if (a.rule) return <TrustBadge badge={a.rule.trustBadge} className={className} />;
  if (approval.nodeRule) return <TrustBadge badge={approval.nodeRule.trustBadge} className={className} />;
  return <TrustBadge badge="NOT_VERIFIED" className={className} />;
}

export function DemoDataChip({ className }: { className?: string }) {
  return (
    <span
      className={clsx('inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-100 px-2 py-1 text-amber-900', className)}
      title="All data in this prototype is synthetic."
    >
      <Icon name="science" className="text-[14px]" filled />
      <span className="text-label-md uppercase">Demo data</span>
    </span>
  );
}

export function CodeTag({ children, className }: { children: string; className?: string }) {
  return <span className={clsx('font-code-tabular text-code-tabular text-on-surface-variant', className)}>{children}</span>;
}
