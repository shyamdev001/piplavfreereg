import * as React from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Plus, FileText, CalendarCheck, ClipboardList, ChevronRight, Inbox } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { getAgentDashboardStats, type AgentDashboardStats } from '@/services/dashboard.service';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { LeadStatusBadge } from '@/components/leads/LeadStatusBadge';
import { formatDate } from '@/lib/utils';

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export function AgentDashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = React.useState<AgentDashboardStats | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    getAgentDashboardStats()
      .then(setStats)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="mx-auto max-w-2xl space-y-7 p-4 pt-6">
      <div>
        <p className="text-sm font-semibold text-primary">{greeting()}</p>
        <h1 className="text-[1.7rem] font-extrabold leading-tight tracking-tight text-foreground">
          {user?.name?.split(' ')[0]}
        </h1>
      </div>

      {loading ? (
        <div className="grid grid-cols-3 gap-3">
          <Skeleton className="h-[5.5rem]" />
          <Skeleton className="h-[5.5rem]" />
          <Skeleton className="h-[5.5rem]" />
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-3">
          <MiniStat icon={<ClipboardList className="h-4 w-4" />} label="Total" value={stats?.total ?? 0} tone="primary" />
          <MiniStat icon={<CalendarCheck className="h-4 w-4" />} label="Today" value={stats?.today ?? 0} tone="info" />
          <MiniStat icon={<FileText className="h-4 w-4" />} label="Drafts" value={stats?.drafts ?? 0} tone="accent" />
        </div>
      )}

      <Button asChild size="xl" className="w-full text-base">
        <Link to="/agent/leads/new">
          <Plus className="h-5 w-5" strokeWidth={2.5} />
          New Registration
        </Link>
      </Button>

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">Recent Registrations</h2>
          <Link to="/agent/leads" className="flex items-center text-sm font-bold text-primary">
            View all
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>

        {loading ? (
          <div className="space-y-2.5">
            <Skeleton className="h-[4.5rem]" />
            <Skeleton className="h-[4.5rem]" />
          </div>
        ) : stats && stats.recentLeads.length > 0 ? (
          <div className="space-y-2.5">
            {stats.recentLeads.map((lead, i) => (
              <motion.div
                key={lead._id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: i * 0.05, ease: [0.16, 1, 0.3, 1] }}
              >
                <Link to={`/agent/leads/${lead._id}`}>
                  <Card className="transition-all duration-150 active:scale-[0.98] active:shadow-warm-sm hover:shadow-warm-md">
                    <CardContent className="flex items-center justify-between gap-3 p-4">
                      <div className="min-w-0">
                        <p className="truncate text-[0.95rem] font-bold text-foreground">
                          {lead.customerBasicDetails?.fullName || 'Unnamed customer'}
                        </p>
                        <p className="font-mono-brand text-xs text-muted-foreground">
                          {lead.leadId} &middot; {formatDate(lead.createdAt)}
                        </p>
                      </div>
                      <LeadStatusBadge status={lead.status} className="flex-shrink-0" />
                    </CardContent>
                  </Card>
                </Link>
              </motion.div>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={<Inbox className="h-6 w-6" />}
            title="No registrations yet"
            description="Registrations you submit will show up here."
          />
        )}
      </div>
    </div>
  );
}

const TONE_STYLES: Record<'primary' | 'info' | 'accent', string> = {
  primary: 'bg-primary/10 text-primary',
  info: 'bg-info/10 text-info',
  accent: 'bg-accent/18 text-accent-foreground',
};

function MiniStat({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  tone: 'primary' | 'info' | 'accent';
}) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-1.5 p-3.5 text-center">
        <div className={`rounded-lg p-1.5 ${TONE_STYLES[tone]}`}>{icon}</div>
        <p className="font-mono-brand text-xl font-bold leading-none tabular-nums">{value}</p>
        <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{label}</p>
      </CardContent>
    </Card>
  );
}
