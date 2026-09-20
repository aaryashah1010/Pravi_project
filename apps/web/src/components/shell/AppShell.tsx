import { useEffect, useState, type ReactNode } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Icon } from '../ui/Icon';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';

export function AppShell() {
  const [menuOpen, setMenuOpen] = useState(false);
  const { pathname } = useLocation();

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  return (
    <div className="min-h-screen bg-background">
      <div className="fixed bottom-0 left-0 top-0 z-50 hidden lg:block">
        <Sidebar />
      </div>
      {menuOpen ? (
        <div className="fixed inset-0 z-[55] lg:hidden">
          <div className="absolute inset-0 bg-slate-900/40" onClick={() => setMenuOpen(false)} aria-hidden="true" />
          <div className="absolute bottom-0 left-0 top-0 shadow-xl">
            <Sidebar onNavigate={() => setMenuOpen(false)} />
          </div>
        </div>
      ) : null}
      <div className="flex min-h-screen flex-col lg:pl-64">
        <TopBar onMenu={() => setMenuOpen(true)} />
        <main className="flex-1 pt-16">
          <Outlet />
        </main>
        <footer className="border-t border-outline-variant/40 bg-surface-container-low px-4 py-2 text-center text-body-sm text-on-surface-variant">
          <Icon name="science" className="mr-1 align-[-3px] text-[14px]" />
          Technical prototype — rule registry pending departmental/legal review.
        </footer>
      </div>
    </div>
  );
}

/** Standard page padding used by every routed screen. */
export function Page({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={`mx-auto w-full max-w-[1800px] space-y-4 p-4 ${className ?? ''}`}>{children}</div>;
}
