import * as React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ClipboardList, CalendarDays, Home, Building2, Users, ArrowRight } from 'lucide-react';
import { StatCard } from '@/components/ui/stat-card';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { getAdminDashboardStats, type AdminDashboardStats } from '@/services/dashboard.service';
import { LEAD_STATUSES } from '@/types';
import { STATUS_DOT } from '@/components/leads/LeadStatusBadge';

export function AdminDashboardPage() {
  const [stats, setStats] = React.useState<AdminDashboardStats | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    getAdminDashboardStats()
      .then(setStats)
      .finally(() => setLoading(false));
  }, []);

  const maxStatusCount = stats ? Math.max(1, ...Object.values(stats.byStatus)) : 1;

  return (
    <div className="max-w-6xl space-y-6">
      <div>
        <h1 className="text-[1.75rem] font-extrabold tracking-tight text-foreground">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Live overview of all Piplav village solar registrations.</p>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
          <StatCard label="Total Registrations" value={stats?.totalLeads ?? 0} icon={<ClipboardList className="h-5 w-5" />} tone="primary" />
          <StatCard label="Today's Registrations" value={stats?.todaysLeads ?? 0} icon={<CalendarDays className="h-5 w-5" />} tone="accent" />
          <StatCard label="Residential" value={stats?.residential ?? 0} icon={<Home className="h-5 w-5" />} tone="info" />
          <StatCard label="Commercial" value={stats?.commercial ?? 0} icon={<Building2 className="h-5 w-5" />} tone="premium" />
          <StatCard label="Total Agents" value={stats?.totalAgents ?? 0} icon={<Users className="h-5 w-5" />} tone="success" />
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Registrations by Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading ? (
              <Skeleton className="h-56" />
            ) : (
              LEAD_STATUSES.filter((s) => s !== 'ARCHIVED').map((status, i) => {
                const count = stats?.byStatus[status] ?? 0;
                return (
                  <div key={status} className="flex items-center gap-3">
                    <span className="w-28 flex-shrink-0 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                      {status}
                    </span>
                    <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-secondary">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${(count / maxStatusCount) * 100}%` }}
                        transition={{ duration: 0.6, delay: i * 0.04, ease: [0.16, 1, 0.3, 1] }}
                        className={`h-full rounded-full ${STATUS_DOT[status]}`}
                      />
                    </div>
                    <span className="w-8 flex-shrink-0 text-right font-mono-brand text-sm font-bold tabular-nums">
                      {count}
                    </span>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>

        <Card className="flex flex-col justify-between lg:col-span-2">
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2.5">
            <Link
              to="/admin/leads"
              className="flex items-center justify-between rounded-xl border border-border/70 p-3.5 text-sm font-bold text-foreground transition-colors hover:border-primary/40 hover:bg-primary/5"
            >
              View all leads
              <ArrowRight className="h-4 w-4 text-primary" />
            </Link>
            <Link
              to="/admin/agents"
              className="flex items-center justify-between rounded-xl border border-border/70 p-3.5 text-sm font-bold text-foreground transition-colors hover:border-primary/40 hover:bg-primary/5"
            >
              Manage field agents
              <ArrowRight className="h-4 w-4 text-primary" />
            </Link>
            <Link
              to="/admin/audit-logs"
              className="flex items-center justify-between rounded-xl border border-border/70 p-3.5 text-sm font-bold text-foreground transition-colors hover:border-primary/40 hover:bg-primary/5"
            >
              Review audit trail
              <ArrowRight className="h-4 w-4 text-primary" />
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
