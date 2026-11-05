import * as React from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Search, Download, X, ChevronLeft, ChevronRight, ArchiveRestore, Archive as ArchiveIcon, ArrowUpRight } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { LeadStatusBadge } from '@/components/leads/LeadStatusBadge';
import { useDebounce } from '@/hooks/useDebounce';
import * as leadService from '@/services/lead.service';
import * as agentService from '@/services/agent.service';
import { archiveLead, restoreLead } from '@/services/lead.service';
import { getErrorMessage } from '@/lib/axios';
import { toast } from 'sonner';
import { formatDate, initials } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import type { Agent, Lead } from '@/types';
import { LEAD_STATUSES } from '@/types';

const ALL = '__all__';

export function LeadsTablePage() {
  const navigate = useNavigate();
  const isAdmin = useAuth().user?.role === 'ADMIN';
  const [searchParams, setSearchParams] = useSearchParams();
  const [leads, setLeads] = React.useState<Lead[]>([]);
  const [agents, setAgents] = React.useState<Agent[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [total, setTotal] = React.useState(0);
  const [page, setPage] = React.useState(1);
  const [limit] = React.useState(20);

  const [search, setSearch] = React.useState('');
  const debouncedSearch = useDebounce(search);
  const [agentId, setAgentId] = React.useState<string>(searchParams.get('agentId') ?? ALL);
  const [customerType, setCustomerType] = React.useState<string>(ALL);
  const [status, setStatus] = React.useState<string>(ALL);
  const [dateFrom, setDateFrom] = React.useState('');
  const [dateTo, setDateTo] = React.useState('');
  const [showArchived, setShowArchived] = React.useState(false);

  React.useEffect(() => {
    agentService.listAgents().then((list) => setAgents(list.filter((a) => a.role === 'AGENT'))).catch(() => undefined);
  }, []);

  const fetchLeads = React.useCallback(() => {
    setLoading(true);
    leadService
      .listLeads({
        page,
        limit,
        search: debouncedSearch || undefined,
        agentId: agentId === ALL ? undefined : agentId,
        customerType: customerType === ALL ? undefined : customerType,
        status: status === ALL ? undefined : status,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        archived: showArchived,
      })
      .then((res) => {
        setLeads(res.leads);
        setTotal(res.pagination.total);
      })
      .catch((err) => toast.error(getErrorMessage(err, 'Unable to load registrations.')))
      .finally(() => setLoading(false));
  }, [page, limit, debouncedSearch, agentId, customerType, status, dateFrom, dateTo, showArchived]);

  React.useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  React.useEffect(() => {
    setPage(1);
  }, [debouncedSearch, agentId, customerType, status, dateFrom, dateTo, showArchived]);

  React.useEffect(() => {
    if (agentId === ALL) {
      if (searchParams.has('agentId')) setSearchParams({}, { replace: true });
    } else {
      setSearchParams({ agentId }, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentId]);

  const clearFilters = () => {
    setSearch('');
    setAgentId(ALL);
    setCustomerType(ALL);
    setStatus(ALL);
    setDateFrom('');
    setDateTo('');
  };

  const hasActiveFilters = search || agentId !== ALL || customerType !== ALL || status !== ALL || dateFrom || dateTo;

  const handleArchiveToggle = async (lead: Lead) => {
    try {
      if (lead.archived) {
        await restoreLead(lead._id);
        toast.success(`${lead.leadId} restored.`);
      } else {
        await archiveLead(lead._id);
        toast.success(`${lead.leadId} archived.`);
      }
      fetchLeads();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  const handleExport = () => {
    const url = leadService.exportLeadsUrl({
      search: debouncedSearch || undefined,
      agentId: agentId === ALL ? undefined : agentId,
      customerType: customerType === ALL ? undefined : customerType,
      status: status === ALL ? undefined : status,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
      archived: showArchived,
      limit: 10000,
    });
    window.open(url, '_blank');
  };

  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <div className="max-w-7xl space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-[1.75rem] font-extrabold tracking-tight text-foreground">Registrations</h1>
          <p className="text-sm text-muted-foreground">
            {total} registration{total === 1 ? '' : 's'} found
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant={showArchived ? 'default' : 'outline'} size="sm" onClick={() => setShowArchived((v) => !v)}>
            <ArchiveIcon className="h-4 w-4" /> {showArchived ? 'Showing Archived' : 'Show Archived'}
          </Button>
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="h-4 w-4" /> Export CSV
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-3.5 rounded-2xl border border-border/70 bg-card p-4 shadow-warm-sm">
        <div className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name, mobile, registration ID, or consumer number"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-11"
          />
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          <Select value={agentId} onValueChange={setAgentId}>
            <SelectTrigger>
              <SelectValue placeholder="Agent" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All Agents</SelectItem>
              {agents.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={customerType} onValueChange={setCustomerType}>
            <SelectTrigger>
              <SelectValue placeholder="Customer Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All Types</SelectItem>
              <SelectItem value="Residential">Residential</SelectItem>
              <SelectItem value="Commercial">Commercial</SelectItem>
            </SelectContent>
          </Select>

          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger>
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All Statuses</SelectItem>
              {LEAD_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        </div>

        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="flex w-fit items-center gap-1 text-xs font-bold text-muted-foreground transition-colors hover:text-primary"
          >
            <X className="h-3.5 w-3.5" /> Clear filters
          </button>
        )}
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-14" />
          ))}
        </div>
      ) : leads.length === 0 ? (
        <EmptyState title="No registrations found" description="Try adjusting your search or filters." />
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Registration ID</TableHead>
                <TableHead>Customer Name</TableHead>
                <TableHead>Mobile</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>System Size</TableHead>
                <TableHead>Agent</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {leads.map((lead) => (
                <TableRow
                  key={lead._id}
                  className="cursor-pointer"
                  onClick={() => navigate(`/admin/leads/${lead._id}`)}
                >
                  <TableCell className="font-mono-brand text-xs font-bold text-primary">{lead.leadId}</TableCell>
                  <TableCell className="font-semibold text-foreground">
                    {lead.customerBasicDetails?.fullName || '-'}
                  </TableCell>
                  <TableCell className="font-mono-brand text-xs">{lead.customerBasicDetails?.mobileNumber || '-'}</TableCell>
                  <TableCell>{lead.customerBasicDetails?.customerType || '-'}</TableCell>
                  <TableCell className="tabular-nums">
                    {lead.solarInformation?.requiredSystemSizeKw ? `${lead.solarInformation.requiredSystemSizeKw} kW` : '-'}
                  </TableCell>
                  <TableCell>
                    {typeof lead.createdBy === 'object' ? (
                      <span className="flex items-center gap-2">
                        <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-primary/10 text-[0.6rem] font-bold text-primary">
                          {initials(lead.createdBy.name)}
                        </span>
                        {lead.createdBy.name}
                      </span>
                    ) : (
                      '-'
                    )}
                  </TableCell>
                  <TableCell>
                    <LeadStatusBadge status={lead.status} />
                  </TableCell>
                  <TableCell className="text-muted-foreground">{formatDate(lead.createdAt)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                      <Button asChild size="sm" variant="ghost">
                        <Link to={`/admin/leads/${lead._id}`}>
                          Open <ArrowUpRight className="h-3.5 w-3.5" />
                        </Link>
                      </Button>
                      {isAdmin && (
                        <Button
                          size="sm"
                          variant="ghost"
                          title={lead.archived ? 'Restore' : 'Archive'}
                          onClick={() => handleArchiveToggle(lead)}
                        >
                          {lead.archived ? <ArchiveRestore className="h-4 w-4" /> : <ArchiveIcon className="h-4 w-4" />}
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          <div className="flex items-center justify-between">
            <p className="text-xs font-medium text-muted-foreground">
              Page {page} of {totalPages}
            </p>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                <ChevronLeft className="h-4 w-4" /> Prev
              </Button>
              <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                Next <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
