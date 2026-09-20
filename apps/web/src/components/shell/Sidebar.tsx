import clsx from 'clsx';
import { NavLink } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { useApprovals, useMyTasks } from '@/lib/queries';
import { Icon } from '../ui/Icon';
import { Logo } from './Logo';

interface NavItem {
  to: string;
  label: string;
  icon: string;
  end?: boolean;
  /** Any-of permissions; omitted means every signed-in user. */
  perms?: string[];
  badge?: number;
  badgeTone?: 'blue' | 'rose';
}

function NavItemLink({ item, onNavigate }: { item: NavItem; onNavigate?: () => void }) {
  return (
    <NavLink
      to={item.to}
      end={item.end}
      onClick={onNavigate}
      className={({ isActive }) =>
        clsx(
          'flex items-center justify-between rounded px-2 py-2 transition-colors',
          isActive ? 'bg-primary-container text-on-primary shadow-sm' : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface',
        )
      }
    >
      <span className="flex items-center gap-2">
        <Icon name={item.icon} className="text-[18px]" />
        <span className="text-label-lg">{item.label}</span>
      </span>
      {item.badge ? (
        <span
          className={clsx(
            'rounded-full px-1.5 py-0.5 font-code-sm text-code-sm font-semibold',
            item.badgeTone === 'rose' ? 'bg-error text-on-error' : 'bg-secondary text-on-secondary',
          )}
        >
          {item.badge}
        </span>
      ) : null}
    </NavLink>
  );
}

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { can } = useAuth();
  const canApprovals = can('approval.review', 'approval.decide');
  const tasks = useMyTasks();
  const approvals = useApprovals({ status: 'open', mine: true }, canApprovals);

  const main: NavItem[] = [
    { to: '/', label: 'Overview', icon: 'dashboard', end: true, perms: ['dashboard.read'] },
    { to: '/projects', label: 'Projects', icon: 'account_tree', perms: ['project.read'] },
    { to: '/tasks', label: 'My Tasks', icon: 'assignment_turned_in', badge: tasks.data?.length, badgeTone: 'blue' },
    { to: '/approvals', label: 'Approvals', icon: 'verified', perms: ['approval.review', 'approval.decide'], badge: approvals.data?.length, badgeTone: 'rose' },
  ];
  const admin: NavItem[] = [
    { to: '/admin/org', label: 'Org & Positions', icon: 'corporate_fare', perms: ['dashboard.read', 'workflow.manage', 'rule.manage'] },
    { to: '/admin/rules', label: 'Rule Registry', icon: 'gavel', perms: ['rule.manage', 'dashboard.read'] },
    { to: '/admin/audit', label: 'Audit Log', icon: 'lock_clock', perms: ['audit.read'] },
  ];
  const visible = (items: NavItem[]) => items.filter((i) => !i.perms || can(...i.perms));
  const mainItems = visible(main);
  const adminItems = visible(admin);

  return (
    <aside className="flex h-full w-64 flex-col border-r border-outline-variant/50 bg-surface-container-lowest">
      <div className="flex h-16 shrink-0 items-center gap-2 border-b border-outline-variant/40 bg-surface-container-low px-4">
        <Logo size={32} />
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-headline-md leading-tight tracking-tight text-primary">InfraFlow</span>
          <span className="truncate font-code-sm text-code-sm text-on-surface-variant">Public works workflow</span>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto py-2">
        <div className="px-4 py-1">
          <span className="text-label-md uppercase tracking-wider text-outline">Lifecycle operations</span>
        </div>
        <nav className="mt-1 flex flex-col space-y-0.5 px-2" aria-label="Primary">
          {mainItems.map((i) => (
            <NavItemLink key={i.to} item={i} onNavigate={onNavigate} />
          ))}
        </nav>
        {adminItems.length > 0 ? (
          <div className="mt-4 border-t border-outline-variant/30 pt-2">
            <div className="px-4 py-1">
              <span className="text-label-md uppercase tracking-wider text-outline">Administration</span>
            </div>
            <nav className="mt-1 flex flex-col space-y-0.5 px-2" aria-label="Administration">
              {adminItems.map((i) => (
                <NavItemLink key={i.to} item={i} onNavigate={onNavigate} />
              ))}
            </nav>
          </div>
        ) : null}
      </div>
      <div className="shrink-0 border-t border-outline-variant/40 bg-surface-container-low/60 p-2">
        <div className="flex items-center justify-between font-code-sm text-code-sm text-on-surface-variant">
          <span>PROTOTYPE BUILD</span>
          <span className="inline-flex items-center font-medium text-tertiary">
            <span className="mr-1 h-1.5 w-1.5 rounded-full bg-tertiary-container" />
            SYNTHETIC DATA
          </span>
        </div>
      </div>
    </aside>
  );
}
