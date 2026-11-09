import * as React from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { LayoutDashboard, Users, ClipboardList, ScrollText, FileText, History, LogOut, Menu, X } from 'lucide-react';
import type { UserRole } from '@/types';
import { useAuth } from '@/hooks/useAuth';
import { cn, initials } from '@/lib/utils';
import { Logo } from '@/components/brand/Logo';

const NAV_ITEMS: Array<{ to: string; label: string; icon: typeof Users; end?: boolean; roles: UserRole[] }> = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true, roles: ['ADMIN', 'VIEWER'] },
  { to: '/admin/leads', label: 'Registrations', icon: ClipboardList, roles: ['ADMIN', 'VIEWER'] },
  { to: '/quotations', label: 'Quotations', icon: FileText, end: true, roles: ['ADMIN', 'VIEWER', 'QUOTATION', 'QUOTATION_STAFF'] },
  { to: '/quotations/history', label: 'Quotation History', icon: History, roles: ['ADMIN', 'VIEWER'] },
  { to: '/admin/agents', label: 'Team', icon: Users, roles: ['ADMIN'] },
  { to: '/admin/audit-logs', label: 'Audit Logs', icon: ScrollText, roles: ['ADMIN'] },
];

const ROLE_CAPTION: Partial<Record<UserRole, string>> = {
  VIEWER: 'Viewer (read-only)',
  QUOTATION: 'Quotations',
  QUOTATION_STAFF: 'Quotation staff',
};

export function AdminLayout() {
  const { user, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = React.useState(false);

  const sidebarContent = (
    <>
      <div className="px-5 py-6">
        <Logo size={38} variant="lockup" />
      </div>
      <nav className="flex flex-1 flex-col gap-1 px-3">
        {NAV_ITEMS.filter((item) => user && item.roles.includes(user.role)).map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            onClick={() => setMobileOpen(false)}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-bold transition-all duration-150',
                isActive
                  ? 'bg-primary text-primary-foreground shadow-warm-md'
                  : 'text-muted-foreground hover:bg-secondary hover:text-foreground',
              )
            }
          >
            <item.icon className="h-[1.1rem] w-[1.1rem]" />
            {item.label}
          </NavLink>
        ))}
      </nav>
      <div className="border-t border-border/70 p-4">
        <div className="flex items-center gap-3 rounded-xl p-1.5 transition-colors hover:bg-secondary/60">
          <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-primary/12 text-xs font-bold text-primary">
            {initials(user?.name ?? 'A')}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold">{user?.name}</p>
            <p className="truncate text-xs text-muted-foreground">
              {(user && ROLE_CAPTION[user.role]) ?? user?.email}
            </p>
          </div>
          <button
            onClick={() => logout()}
            title="Log out"
            className="flex-shrink-0 rounded-lg p-2 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </>
  );

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="hidden w-64 flex-shrink-0 flex-col border-r border-border/70 bg-card md:flex">
        {sidebarContent}
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-foreground/40 backdrop-blur-[2px]" onClick={() => setMobileOpen(false)} />
          <aside className="absolute left-0 top-0 flex h-full w-72 flex-col bg-card shadow-warm-lg">{sidebarContent}</aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b border-border/70 bg-card px-4 py-3 md:hidden">
          <button onClick={() => setMobileOpen((v) => !v)} className="rounded-lg p-2 hover:bg-secondary">
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
          <Logo size={28} variant="lockup" />
        </header>
        <main className="flex-1 overflow-x-hidden p-4 md:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
