import clsx from 'clsx';
import type { ReactNode } from 'react';
import { Icon } from './Icon';

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={clsx('rounded-lg border border-outline-variant/60 bg-surface-container-lowest shadow-sm', className)}>{children}</section>;
}

interface CardHeaderProps {
  title: ReactNode;
  icon?: string;
  subtitle?: ReactNode;
  right?: ReactNode;
  className?: string;
}

export function CardHeader({ title, icon, subtitle, right, className }: CardHeaderProps) {
  return (
    <header className={clsx('flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3', className)}>
      <div className="flex min-w-0 items-center gap-2">
        {icon ? <Icon name={icon} className="text-[20px] text-primary-container" /> : null}
        <div className="min-w-0">
          <h2 className="truncate text-headline-md text-on-surface">{title}</h2>
          {subtitle ? <p className="text-body-sm text-on-surface-variant">{subtitle}</p> : null}
        </div>
      </div>
      {right ? <div className="flex items-center gap-2">{right}</div> : null}
    </header>
  );
}

export function CardBody({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={clsx('p-4', className)}>{children}</div>;
}

export function PageHeader({ title, subtitle, actions, eyebrow }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; eyebrow?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        {eyebrow}
        <h1 className="text-headline-lg text-primary">{title}</h1>
        {subtitle ? <p className="mt-0.5 max-w-3xl text-body-sm text-on-surface-variant">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </div>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-label-md uppercase text-outline">{label}</dt>
      <dd className="mt-0.5 text-body-md text-on-surface">{children}</dd>
    </div>
  );
}

export function Kpi({ label, value, sub, icon, tone = 'default', children }: { label: string; value: ReactNode; sub?: ReactNode; icon?: string; tone?: 'default' | 'rose'; children?: ReactNode }) {
  return (
    <div className="flex flex-col justify-between rounded-lg border border-outline-variant/60 bg-surface-container-lowest p-3 shadow-sm">
      <div>
        <div className="flex items-center justify-between">
          <span className={clsx('text-label-md uppercase tracking-wider', tone === 'rose' ? 'text-error' : 'text-outline')}>{label}</span>
          {icon ? <Icon name={icon} className={clsx('text-[18px]', tone === 'rose' ? 'text-error' : 'text-primary')} /> : null}
        </div>
        <div className="mt-2 flex flex-wrap items-baseline gap-x-2">
          <span className={clsx('text-display-lg', tone === 'rose' ? 'text-error' : 'text-on-surface')}>{value}</span>
          {sub ? <span className="font-code-tabular text-code-tabular text-on-surface-variant">{sub}</span> : null}
        </div>
      </div>
      {children ? <div className="mt-3 rounded bg-surface-container-low/60 p-2">{children}</div> : null}
    </div>
  );
}
