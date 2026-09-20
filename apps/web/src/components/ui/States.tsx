import clsx from 'clsx';
import type { ReactNode } from 'react';
import { ApiError } from '@/lib/api';
import { Button } from './Button';
import { Icon } from './Icon';

export function Skeleton({ className }: { className?: string }) {
  return <div className={clsx('animate-pulse rounded bg-slate-200/70', className)} />;
}

export function SkeletonRows({ rows = 5, className }: { rows?: number; className?: string }) {
  return (
    <div className={clsx('space-y-2 p-4', className)} aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-9 w-full" />
      ))}
    </div>
  );
}

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 text-body-sm text-on-surface-variant" role="status">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-container border-t-transparent" />
      {label ?? 'Loading'}
    </div>
  );
}

interface EmptyStateProps {
  icon?: string;
  title: string;
  message?: ReactNode;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ icon = 'inbox', title, message, action, className }: EmptyStateProps) {
  return (
    <div className={clsx('flex flex-col items-center justify-center px-6 py-10 text-center', className)}>
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-surface-container text-primary-container">
        <Icon name={icon} className="text-[26px]" />
      </div>
      <h3 className="text-headline-md text-on-surface">{title}</h3>
      {message ? <p className="mt-1 max-w-md text-body-md text-on-surface-variant">{message}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

interface ErrorNoticeProps {
  error: unknown;
  onRetry?: () => void;
  className?: string;
  title?: string;
}

/** Maps API error codes to explicit, actionable copy. 409/403/422 are surfaced prominently and never swallowed. */
export function ErrorNotice({ error, onRetry, className, title }: ErrorNoticeProps) {
  if (!error) return null;
  const e = error instanceof ApiError ? error : null;
  const code = e?.code ?? 'ERROR';
  const message = e?.message ?? (error instanceof Error ? error.message : 'Something went wrong.');

  let heading = title ?? 'Something went wrong';
  let tone: 'rose' | 'amber' | 'slate' = 'rose';
  let icon = 'error';
  let extra: ReactNode = null;
  let retryLabel = 'Try again';

  switch (code) {
    case 'STATE_CONFLICT':
      heading = 'This record was changed by someone else';
      tone = 'amber';
      icon = 'sync_problem';
      extra = <p className="mt-1 text-body-sm">The latest version has been reloaded. Review it and try again.</p>;
      retryLabel = 'Reload';
      break;
    case 'AUTHORITY_NOT_RESOLVED':
      heading = 'Competent authority not resolved';
      icon = 'gpp_maybe';
      break;
    case 'RULE_NOT_VERIFIED':
      heading = 'Governing rule is not verified';
      icon = 'gpp_maybe';
      break;
    case 'INSUFFICIENT_SCOPE':
      heading = 'You do not have permission for this action';
      icon = 'lock';
      break;
    case 'VALIDATION_ERROR':
      heading = 'Please check the highlighted details';
      icon = 'rule';
      break;
    case 'NOT_FOUND':
      heading = 'Not found';
      tone = 'slate';
      icon = 'search_off';
      break;
    case 'NETWORK_ERROR':
      heading = 'Cannot reach the server';
      icon = 'cloud_off';
      break;
    default:
      break;
  }

  const palette =
    tone === 'rose'
      ? 'border-red-200 bg-red-50 text-red-900'
      : tone === 'amber'
        ? 'border-amber-200 bg-amber-50 text-amber-900'
        : 'border-slate-300 bg-slate-100 text-slate-800';

  return (
    <div role="alert" className={clsx('rounded-lg border p-3', palette, className)}>
      <div className="flex items-start gap-2">
        <Icon name={icon} className="mt-0.5 text-[20px]" filled />
        <div className="min-w-0 flex-1">
          <p className="text-label-lg font-semibold">{heading}</p>
          <p className="mt-0.5 text-body-md">{message}</p>
          {e && e.fieldErrors.length > 0 ? (
            <ul className="mt-1 list-disc pl-5 text-body-sm">
              {e.fieldErrors.map((f, i) => (
                <li key={`${f.field}-${i}`}>
                  <span className="font-code-sm text-code-sm">{f.field}</span>: {f.message}
                </li>
              ))}
            </ul>
          ) : null}
          {extra}
          <div className="mt-2 flex items-center gap-3">
            {onRetry ? (
              <Button size="sm" onClick={onRetry} icon="refresh">
                {retryLabel}
              </Button>
            ) : null}
            {e?.requestId ? <span className="font-code-sm text-code-sm opacity-70">Request {e.requestId.slice(0, 8)}</span> : null}
          </div>
        </div>
      </div>
    </div>
  );
}

export function InfoBanner({ tone = 'slate', icon = 'info', children, className }: { tone?: 'slate' | 'amber' | 'rose' | 'blue' | 'emerald'; icon?: string; children: ReactNode; className?: string }) {
  const palette = {
    slate: 'border-slate-300 bg-slate-50 text-slate-800',
    amber: 'border-amber-200 bg-amber-50 text-amber-900',
    rose: 'border-red-200 bg-red-50 text-red-900',
    blue: 'border-blue-200 bg-blue-50 text-blue-900',
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-900',
  }[tone];
  return (
    <div className={clsx('flex items-start gap-2 rounded-lg border px-3 py-2 text-body-md', palette, className)}>
      <Icon name={icon} className="mt-0.5 text-[18px]" filled />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
