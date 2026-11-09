import * as React from 'react';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { ChevronLeft, ChevronRight, Download, Eye, History, Pencil, Plus, Search, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { useDebounce } from '@/hooks/useDebounce';
import { getErrorMessage } from '@/lib/axios';
import { cn } from '@/lib/utils';
import * as agentService from '@/services/agent.service';
import * as quotationService from '@/services/quotation.service';
import type { QuotationHistoryAction, QuotationHistoryEntry, QuotationHistoryFilters } from '@/services/quotation.service';
import type { Agent, PaginationMeta } from '@/types';

const ACTION_META: Record<QuotationHistoryAction, { label: string; verb: string; icon: typeof Plus; tone: string }> = {
  QUOTATION_CREATED: { label: 'Created', verb: 'created', icon: Plus, tone: 'bg-primary/12 text-primary' },
  QUOTATION_UPDATED: { label: 'Edited', verb: 'edited', icon: Pencil, tone: 'bg-info/12 text-info' },
  QUOTATION_DOWNLOADED: {
    label: 'Viewed / downloaded PDF',
    verb: 'viewed / downloaded the PDF of',
    icon: Eye,
    tone: 'bg-secondary text-secondary-foreground',
  },
  QUOTATION_DELETED: { label: 'Deleted', verb: 'deleted', icon: Trash2, tone: 'bg-destructive/12 text-destructive' },
};

const ROLE_WORD: Record<string, string> = {
  ADMIN: 'Admin',
  QUOTATION: 'Quotation',
  QUOTATION_STAFF: 'Staff',
  VIEWER: 'Viewer',
};

function formatWhen(iso: string) {
  return new Date(iso).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Asia/Kolkata',
  });
}

const selectClass =
  'h-10 rounded-xl border border-input bg-background px-3 text-sm font-medium text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

/** Admins and viewers: every quotation action - who, what, when - with filters and an Excel (CSV) export. */
export function QuotationHistoryPage() {
  const [params, setParams] = useSearchParams();
  const targetId = params.get('quotation') ?? undefined;
  const targetLabel = params.get('label') ?? undefined;

  const [people, setPeople] = React.useState<Agent[]>([]);
  const [actorId, setActorId] = React.useState('');
  const [action, setAction] = React.useState<QuotationHistoryAction | ''>('');
  const [from, setFrom] = React.useState('');
  const [to, setTo] = React.useState('');
  const [search, setSearch] = React.useState('');
  const debouncedSearch = useDebounce(search, 350);
  const [page, setPage] = React.useState(1);

  const [logs, setLogs] = React.useState<QuotationHistoryEntry[]>([]);
  const [pagination, setPagination] = React.useState<PaginationMeta | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    agentService
      .listAgents()
      .then((list) => setPeople(list.filter((a) => a.role === 'QUOTATION' || a.role === 'QUOTATION_STAFF')))
      .catch(() => setPeople([]));
  }, []);

  const filters: QuotationHistoryFilters = React.useMemo(
    () => ({
      actorId: actorId || undefined,
      action: action || undefined,
      from: from || undefined,
      to: to || undefined,
      search: debouncedSearch || undefined,
      targetId,
    }),
    [actorId, action, from, to, debouncedSearch, targetId],
  );

  React.useEffect(() => {
    setPage(1);
  }, [filters]);

  React.useEffect(() => {
    setLoading(true);
    quotationService
      .listQuotationHistory({ ...filters, page, limit: 50 })
      .then((data) => {
        setLogs(data.logs);
        setPagination(data.pagination);
      })
      .catch((err) => toast.error(getErrorMessage(err)))
      .finally(() => setLoading(false));
  }, [filters, page]);

  const hasFilters = !!(actorId || action || from || to || search);

  return (
    <div className="max-w-6xl space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[1.75rem] font-extrabold tracking-tight text-foreground">Quotation History</h1>
          <p className="text-sm text-muted-foreground">Who created, edited, downloaded or deleted each quotation, and when.</p>
        </div>
        <Button asChild variant="outline">
          <a href={quotationService.quotationHistoryExportUrl(filters)} rel="noopener">
            <Download className="h-4 w-4" /> Download Excel (CSV)
          </a>
        </Button>
      </div>

      {targetId && (
        <div className="flex items-center gap-2 rounded-xl border border-primary/40 bg-primary/5 px-3.5 py-2.5 text-sm">
          <History className="h-4 w-4 text-primary" />
          <span className="min-w-0 flex-1 truncate">
            Showing only <span className="font-bold">{targetLabel ?? 'one quotation'}</span>
          </span>
          <Button size="sm" variant="ghost" onClick={() => setParams({})}>
            <X className="h-4 w-4" /> Show all
          </Button>
        </div>
      )}

      <Card>
        <CardContent className="flex flex-wrap items-center gap-3 p-4">
          <div className="relative min-w-[200px] flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Customer or quotation no."
              className="pl-9"
              aria-label="Search history"
            />
          </div>
          <select className={selectClass} value={actorId} onChange={(e) => setActorId(e.target.value)} aria-label="Filter by person">
            <option value="">Everyone</option>
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({ROLE_WORD[p.role] ?? p.role})
              </option>
            ))}
          </select>
          <select
            className={selectClass}
            value={action}
            onChange={(e) => setAction(e.target.value as QuotationHistoryAction | '')}
            aria-label="Filter by action"
          >
            <option value="">All actions</option>
            {(Object.keys(ACTION_META) as QuotationHistoryAction[]).map((a) => (
              <option key={a} value={a}>
                {ACTION_META[a].label}
              </option>
            ))}
          </select>
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
              From
              <Input
                type="date"
                value={from}
                max={to || undefined}
                onChange={(e) => setFrom(e.target.value)}
                aria-label="From date"
                className="w-[155px]"
              />
            </label>
            <label className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
              To
              <Input
                type="date"
                value={to}
                min={from || undefined}
                onChange={(e) => setTo(e.target.value)}
                aria-label="To date"
                className="w-[155px]"
              />
            </label>
          </div>
          {hasFilters && (
            <div className="w-full">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setActorId('');
                  setAction('');
                  setFrom('');
                  setTo('');
                  setSearch('');
                }}
              >
                <X className="h-4 w-4" /> Clear filters
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </div>
      ) : logs.length === 0 ? (
        <EmptyState icon={<History className="h-6 w-6" />} title="Nothing here yet" description="Quotation actions will appear here." />
      ) : (
        <div className="space-y-2">
          {logs.map((log) => {
            const meta = ACTION_META[log.action];
            const Icon = meta?.icon ?? History;
            return (
              <Card key={log._id}>
                <CardContent className="flex items-start gap-3 p-4">
                  <span className={cn('mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full', meta?.tone)}>
                    <Icon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1 space-y-0.5">
                    <p className="text-sm text-foreground">
                      <span className="font-bold">{log.actorName}</span>{' '}
                      <span className="text-xs text-muted-foreground">({ROLE_WORD[log.actorRole] ?? log.actorRole})</span>{' '}
                      {meta?.verb ?? log.action}{' '}
                      <span className="font-mono-brand text-xs font-bold">{log.targetLabel}</span>
                    </p>
                    {log.details && <p className="break-words text-xs text-muted-foreground">{log.details}</p>}
                  </div>
                  <time className="flex-shrink-0 text-right text-xs font-medium text-muted-foreground" dateTime={log.createdAt}>
                    {formatWhen(log.createdAt)}
                  </time>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium text-muted-foreground">
            Page {pagination.page} of {pagination.totalPages} · {pagination.total} entries
          </p>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              <ChevronLeft className="h-4 w-4" /> Prev
            </Button>
            <Button size="sm" variant="outline" disabled={page >= pagination.totalPages} onClick={() => setPage((p) => p + 1)}>
              Next <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
