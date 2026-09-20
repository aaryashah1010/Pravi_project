import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { primaryPosition, primaryRoleLabel, useAuth } from '@/lib/auth';
import { DemoDataChip } from '../ui/Badge';
import { Icon } from '../ui/Icon';
import { NotificationBell } from './NotificationBell';

export function TopBar({ onMenu }: { onMenu: () => void }) {
  const { me, logout, can } = useAuth();
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const pos = primaryPosition(me);

  const onSearch = (e: FormEvent) => {
    e.preventDefault();
    const term = q.trim();
    navigate(term ? `/projects?q=${encodeURIComponent(term)}` : '/projects');
  };

  return (
    <header className="fixed left-0 right-0 top-0 z-40 h-16 border-b border-outline-variant/40 bg-surface-container-lowest px-4 lg:left-64">
      <div className="flex h-16 items-center justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <button type="button" onClick={onMenu} aria-label="Open navigation" className="rounded p-1.5 text-on-surface-variant hover:bg-surface-container lg:hidden">
            <Icon name="menu" className="text-[22px]" />
          </button>
          {can('project.read') ? (
            <form onSubmit={onSearch} role="search" className="relative w-full max-w-xl">
              <Icon name="search" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-outline" />
              <input
                type="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search projects by code or name"
                aria-label="Search projects"
                className="w-full rounded border border-outline-variant/60 bg-background py-1.5 pl-9 pr-3 text-body-md text-on-surface placeholder:text-outline focus:border-secondary focus:outline-none"
              />
            </form>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <DemoDataChip />
          <NotificationBell />
          <div className="h-6 w-px bg-outline-variant/50" />
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary">
              <Icon name="person" className="text-[18px] text-on-primary" />
            </div>
            <div className="hidden min-w-0 flex-col text-left md:flex">
              <span className="max-w-[220px] truncate text-body-md font-semibold leading-snug text-on-surface">{me?.user.displayName}</span>
              <span className="max-w-[220px] truncate font-code-sm text-code-sm leading-none text-on-surface-variant">
                {pos ? `${pos.designation} · ${pos.officeName}` : primaryRoleLabel(me)}
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                logout();
                navigate('/login', { replace: true });
              }}
              aria-label="Sign out"
              title="Sign out"
              className="rounded p-1.5 text-on-surface-variant hover:bg-surface-container hover:text-on-surface"
            >
              <Icon name="logout" className="text-[20px]" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
