import clsx from 'clsx';
import { Link, type LinkProps } from 'react-router-dom';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Icon } from './Icon';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';
type Size = 'md' | 'sm';

export function btnClass(variant: Variant = 'secondary', size: Size = 'md', extra?: string): string {
  return clsx(
    'inline-flex shrink-0 items-center justify-center gap-1.5 rounded border font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-secondary focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50',
    size === 'md' ? 'h-9 px-3.5 text-body-md' : 'h-8 px-2.5 text-body-sm',
    variant === 'primary' && 'border-primary-container bg-primary-container text-on-primary hover:bg-secondary',
    variant === 'secondary' && 'border-slate-300 bg-white text-slate-800 hover:border-slate-400 hover:bg-slate-50',
    variant === 'danger' && 'border-red-700 bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-300',
    variant === 'ghost' && 'border-transparent bg-transparent text-secondary hover:bg-surface-container',
    extra,
  );
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  icon?: string;
  loading?: boolean;
  children?: ReactNode;
}

export function Button({ variant = 'secondary', size = 'md', icon, loading, className, children, disabled, type = 'button', ...rest }: ButtonProps) {
  return (
    <button type={type} className={btnClass(variant, size, className)} disabled={disabled || loading} {...rest}>
      {loading ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" /> : icon ? <Icon name={icon} className="text-[16px]" /> : null}
      {children}
    </button>
  );
}

interface LinkButtonProps extends LinkProps {
  variant?: Variant;
  size?: Size;
  icon?: string;
}

export function LinkButton({ variant = 'secondary', size = 'md', icon, className, children, ...rest }: LinkButtonProps) {
  return (
    <Link className={btnClass(variant, size, className)} {...rest}>
      {icon ? <Icon name={icon} className="text-[16px]" /> : null}
      {children}
    </Link>
  );
}
