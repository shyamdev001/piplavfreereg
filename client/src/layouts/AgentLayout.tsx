import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { Home, ListChecks, Plus, LogOut } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { cn, initials } from '@/lib/utils';
import { Logo } from '@/components/brand/Logo';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';

export function AgentLayout() {
  const { user, logout } = useAuth();
  const location = useLocation();

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border/70 bg-card/95 px-4 py-3 backdrop-blur-sm">
        <Logo size={34} variant="lockup" />

        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-2 rounded-full py-1 pl-1 pr-1 transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/12 text-xs font-bold text-primary">
              {initials(user?.name ?? 'A')}
            </span>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel className="flex flex-col gap-0.5">
              <span className="text-sm font-bold text-foreground">{user?.name}</span>
              <span className="truncate text-xs font-normal normal-case text-muted-foreground">{user?.email}</span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => logout()} className="text-destructive focus:bg-destructive/10 focus:text-destructive">
              <LogOut className="mr-2 h-4 w-4" />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </header>

      <main className="flex-1 pb-28">
        <Outlet />
      </main>

      <nav
        className="fixed inset-x-4 bottom-4 z-30 mx-auto flex max-w-sm items-center justify-between rounded-2xl border border-border/60 bg-card/95 px-3 py-2 shadow-warm-lg backdrop-blur-md"
        style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))' }}
      >
        <NavItem to="/agent" icon={<Home className="h-5 w-5" />} label="Home" end />

        <NavLink
          to="/agent/leads/new"
          className="relative -mt-8 flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.25),0_10px_24px_-6px_hsl(var(--shadow-color)/0.45)] transition-transform active:scale-95"
          aria-label="Add new registration"
        >
          <Plus className="h-6 w-6" strokeWidth={2.5} />
        </NavLink>

        <NavItem
          to="/agent/leads"
          icon={<ListChecks className="h-5 w-5" />}
          label="My Registrations"
          active={location.pathname.startsWith('/agent/leads') && location.pathname !== '/agent/leads/new'}
        />
      </nav>
    </div>
  );
}

function NavItem({
  to,
  icon,
  label,
  end,
  active,
}: {
  to: string;
  icon: React.ReactNode;
  label: string;
  end?: boolean;
  active?: boolean;
}) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        cn(
          'flex min-w-[64px] flex-col items-center gap-0.5 rounded-xl px-3 py-1.5 text-[10.5px] font-bold uppercase tracking-wide transition-colors',
          (active ?? isActive) ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
        )
      }
    >
      {icon}
      {label}
    </NavLink>
  );
}
