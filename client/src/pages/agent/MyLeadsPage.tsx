import * as React from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, FileText, ClipboardX, ArrowUpRight, ChevronRight } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { LeadStatusBadge } from '@/components/leads/LeadStatusBadge';
import { useDebounce } from '@/hooks/useDebounce';
import { listLeads } from '@/services/lead.service';
import type { Lead } from '@/types';
import { formatDate } from '@/lib/utils';

export function MyLeadsPage() {
  const [tab, setTab] = React.useState<'submitted' | 'drafts'>('submitted');
  const [search, setSearch] = React.useState('');
  const debouncedSearch = useDebounce(search);
  const [leads, setLeads] = React.useState<Lead[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    setLoading(true);
    listLeads({ search: debouncedSearch || undefined, isDraft: tab === 'drafts', limit: 50 })
      .then((res) => setLeads(res.leads))
      .finally(() => setLoading(false));
  }, [tab, debouncedSearch]);

  return (
    <div className="mx-auto max-w-2xl space-y-5 p-4 pt-6">
      <h1 className="text-2xl font-extrabold tracking-tight text-foreground">My Registrations</h1>

      <div className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search by name, mobile, or registration ID"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-11"
        />
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as 'submitted' | 'drafts')}>
        <TabsList className="w-full">
          <TabsTrigger value="submitted" className="flex-1">
            Submitted
          </TabsTrigger>
          <TabsTrigger value="drafts" className="flex-1">
            Drafts
          </TabsTrigger>
        </TabsList>

        <TabsContent value={tab}>
          {loading ? (
            <div className="space-y-2.5">
              <Skeleton className="h-[4.5rem]" />
              <Skeleton className="h-[4.5rem]" />
              <Skeleton className="h-[4.5rem]" />
            </div>
          ) : leads.length === 0 ? (
            <EmptyState
              icon={tab === 'drafts' ? <FileText className="h-6 w-6" /> : <ClipboardX className="h-6 w-6" />}
              title={tab === 'drafts' ? 'No drafts in progress' : 'No registrations found'}
              description={tab === 'drafts' ? "Registrations you start but don't finish will appear here." : 'Try a different search or add a new registration.'}
            />
          ) : (
            <AnimatePresence mode="popLayout">
              <div className="space-y-2.5">
                {leads.map((lead, i) => (
                  <motion.div
                    key={lead._id}
                    layout
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.25, delay: Math.min(i * 0.03, 0.3) }}
                  >
                    <Link to={tab === 'drafts' ? `/agent/leads/${lead._id}/edit` : `/agent/leads/${lead._id}`}>
                      <Card className="transition-all duration-150 active:scale-[0.98] hover:shadow-warm-md">
                        <CardContent className="flex items-center justify-between gap-3 p-4">
                          <div className="min-w-0">
                            <p className="truncate text-[0.95rem] font-bold text-foreground">
                              {lead.customerBasicDetails?.fullName || 'Unnamed customer'}
                            </p>
                            <p className="font-mono-brand text-xs text-muted-foreground">
                              {lead.leadId} &middot; {formatDate(lead.createdAt)}
                            </p>
                          </div>
                          {tab === 'drafts' ? (
                            <span className="flex flex-shrink-0 items-center gap-1 rounded-full bg-accent/18 px-3 py-1 text-xs font-bold text-accent-foreground">
                              Continue
                              <ArrowUpRight className="h-3.5 w-3.5" />
                            </span>
                          ) : (
                            <div className="flex flex-shrink-0 items-center gap-1">
                              <LeadStatusBadge status={lead.status} />
                              <ChevronRight className="h-4 w-4 text-muted-foreground/50" />
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </Link>
                  </motion.div>
                ))}
              </div>
            </AnimatePresence>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
