import clsx from 'clsx';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMarkAllNotificationsRead, useMarkNotificationRead, useNotifications } from '@/lib/queries';
import { relativeTime } from '@/lib/format';
import type { NotificationDto } from '@/lib/types';
import { Icon } from '../ui/Icon';

const SEVERITY_ICON: Record<string, { icon: string; cls: string }> = {
  CRITICAL: { icon: 'error', cls: 'text-red-600' },
  WARNING: { icon: 'warning', cls: 'text-amber-600' },
  INFO: { icon: 'info', cls: 'text-blue-600' },
};

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { data, isError } = useNotifications();
  const markOne = useMarkNotificationRead();
  const markAll = useMarkAllNotificationsRead();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const unread = data?.unread ?? 0;

  const openItem = (n: NotificationDto) => {
    if (!n.read) markOne.mutate(n.id);
    setOpen(false);
    if (n.link && n.link.startsWith('/')) navigate(n.link);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="relative rounded p-1.5 text-on-surface-variant transition-colors hover:bg-surface-container hover:text-on-surface"
      >
        <Icon name="notifications" className="text-[20px]" />
        {unread > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-error px-1 font-code-sm text-[10px] font-semibold leading-none text-on-error ring-2 ring-surface-container-lowest">
            {unread > 99 ? '99+' : unread}
          </span>
        ) : null}
      </button>
      {open ? (
        <div className="absolute right-0 top-full z-[65] mt-2 w-[380px] max-w-[calc(100vw-2rem)] rounded-lg border border-slate-300 bg-white shadow-lg">
          <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2">
            <h2 className="text-label-lg font-semibold text-on-surface">Notifications</h2>
            <button
              type="button"
              disabled={unread === 0 || markAll.isPending}
              onClick={() => markAll.mutate()}
              className="text-body-sm font-medium text-secondary hover:underline disabled:cursor-not-allowed disabled:text-slate-400 disabled:no-underline"
            >
              Mark all read
            </button>
          </div>
          <div className="max-h-[420px] overflow-y-auto">
            {isError ? (
              <p className="p-4 text-body-md text-on-surface-variant">Notifications could not be loaded.</p>
            ) : !data ? (
              <p className="p-4 text-body-md text-on-surface-variant">Loading…</p>
            ) : data.items.length === 0 ? (
              <div className="flex flex-col items-center px-4 py-8 text-center text-on-surface-variant">
                <Icon name="notifications_off" className="mb-1 text-[28px]" />
                <p className="text-body-md">You are all caught up.</p>
              </div>
            ) : (
              <ul>
                {data.items.map((n) => {
                  const sev = SEVERITY_ICON[n.severity] ?? SEVERITY_ICON.INFO!;
                  return (
                    <li key={n.id} className="border-b border-slate-100 last:border-b-0">
                      <button
                        type="button"
                        onClick={() => openItem(n)}
                        className={clsx('flex w-full items-start gap-2 px-3 py-2 text-left hover:bg-slate-50', !n.read && 'bg-blue-50/50')}
                      >
                        <Icon name={sev.icon} className={clsx('mt-0.5 text-[18px]', sev.cls)} filled />
                        <span className="min-w-0 flex-1">
                          <span className={clsx('block text-body-md', n.read ? 'text-slate-700' : 'font-semibold text-on-surface')}>{n.title}</span>
                          <span className="block text-body-sm text-on-surface-variant">{n.body}</span>
                          <span className="mt-0.5 block text-body-sm text-outline">{relativeTime(n.createdAt)}</span>
                        </span>
                        {!n.read ? <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-secondary" aria-label="Unread" /> : null}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
