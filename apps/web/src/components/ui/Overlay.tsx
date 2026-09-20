import clsx from 'clsx';
import { useEffect, useId, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from './Icon';

function useEscape(onClose: () => void, active: boolean) {
  useEffect(() => {
    if (!active) return;
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose, active]);
}

interface ModalProps {
  open: boolean;
  title: ReactNode;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  width?: string;
}

/** Level-3 surface: neutral slate scrim at 40%, 1px strong border. */
export function Modal({ open, title, onClose, children, footer, width = 'max-w-lg' }: ModalProps) {
  const titleId = useId();
  useEscape(onClose, open);
  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40" onClick={onClose} aria-hidden="true" />
      <div role="dialog" aria-modal="true" aria-labelledby={titleId} className={clsx('relative flex max-h-[90vh] w-full flex-col rounded-lg border border-slate-400 bg-white shadow-xl', width)}>
        <header className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <h2 id={titleId} className="text-headline-md text-on-surface">
            {title}
          </h2>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded p-1 text-outline hover:bg-surface-container hover:text-on-surface">
            <Icon name="close" />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">{children}</div>
        {footer ? <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 bg-slate-50 px-4 py-3">{footer}</footer> : null}
      </div>
    </div>,
    document.body,
  );
}

interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  children: ReactNode;
  /** Tailwind width class; the design system fixes the inspector at 384px. */
  width?: string;
  /** `inline` docks the drawer inside a positioned parent (graph canvas); `overlay` covers the viewport. */
  mode?: 'overlay' | 'inline';
}

export function Drawer({ open, onClose, title, children, width = 'w-[384px]', mode = 'overlay' }: DrawerProps) {
  useEscape(onClose, open && mode === 'overlay');
  if (!open) return null;
  const panel = (
    <aside
      role="complementary"
      className={clsx(
        'flex flex-col border-l border-slate-300 bg-white shadow-xl',
        width,
        mode === 'overlay' ? 'fixed bottom-0 right-0 top-0 z-[60] max-w-full' : 'absolute bottom-0 right-0 top-0 z-20 max-w-full',
      )}
    >
      {title !== undefined ? (
        <header className="flex items-start justify-between gap-2 border-b border-slate-100 px-4 py-3">
          <div className="min-w-0 flex-1">{title}</div>
          <button type="button" onClick={onClose} aria-label="Close panel" className="rounded p-1 text-outline hover:bg-surface-container hover:text-on-surface">
            <Icon name="close" />
          </button>
        </header>
      ) : null}
      <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
    </aside>
  );
  if (mode === 'inline') return panel;
  return createPortal(
    <>
      <div className="fixed inset-0 z-[55] bg-slate-900/30" onClick={onClose} aria-hidden="true" />
      {panel}
    </>,
    document.body,
  );
}
