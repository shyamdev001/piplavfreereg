import * as React from 'react';
import {
  ChevronLeft,
  ChevronRight,
  ScrollText,
  LogIn,
  LogOut,
  Plus,
  Pencil,
  RefreshCw,
  Archive,
  ArchiveRestore,
  Upload,
  Eye,
  Download,
  Trash2,
  UserPlus,
  UserCog,
  UserX,
  UserCheck,
  KeyRound,
  ShieldAlert,
} from 'lucide-react';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import * as auditService from '@/services/audit.service';
import { cn, formatDate } from '@/lib/utils';
import type { AuditLogEntry } from '@/types';

const ACTION_META: Record<string, { label: string; icon: React.ComponentType<{ className?: string }>; tone: string }> = {
  LOGIN: { label: 'Logged in', icon: LogIn, tone: 'bg-success/12 text-success' },
  LOGIN_FAILED: { label: 'Failed login attempt', icon: ShieldAlert, tone: 'bg-destructive/12 text-destructive' },
  LOGOUT: { label: 'Logged out', icon: LogOut, tone: 'bg-secondary text-secondary-foreground' },
  LEAD_CREATED: { label: 'Created registration', icon: Plus, tone: 'bg-primary/12 text-primary' },
  LEAD_UPDATED: { label: 'Updated registration', icon: Pencil, tone: 'bg-info/12 text-info' },
  LEAD_STATUS_CHANGED: { label: 'Changed registration status', icon: RefreshCw, tone: 'bg-accent/18 text-accent-foreground' },
  LEAD_ARCHIVED: { label: 'Archived registration', icon: Archive, tone: 'bg-muted text-muted-foreground' },
  LEAD_RESTORED: { label: 'Restored registration', icon: ArchiveRestore, tone: 'bg-success/12 text-success' },
  DOCUMENT_UPLOADED: { label: 'Uploaded document', icon: Upload, tone: 'bg-primary/12 text-primary' },
  DOCUMENT_VIEWED: { label: 'Viewed document', icon: Eye, tone: 'bg-info/12 text-info' },
  DOCUMENT_DOWNLOADED: { label: 'Downloaded document', icon: Download, tone: 'bg-info/12 text-info' },
  DOCUMENT_DELETED: { label: 'Deleted document', icon: Trash2, tone: 'bg-destructive/12 text-destructive' },
  AGENT_CREATED: { label: 'Created agent', icon: UserPlus, tone: 'bg-premium/12 text-premium' },
  AGENT_UPDATED: { label: 'Updated agent', icon: UserCog, tone: 'bg-info/12 text-info' },
  AGENT_DISABLED: { label: 'Disabled agent', icon: UserX, tone: 'bg-destructive/12 text-destructive' },
  AGENT_ENABLED: { label: 'Enabled agent', icon: UserCheck, tone: 'bg-success/12 text-success' },
  AGENT_CREDENTIALS_RESET: { label: 'Reset agent credentials', icon: KeyRound, tone: 'bg-accent/18 text-accent-foreground' },
};

export function AuditLogPage() {
  const [logs, setLogs] = React.useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [page, setPage] = React.useState(1);
  const [totalPages, setTotalPages] = React.useState(1);

  React.useEffect(() => {
    setLoading(true);
    auditService
      .listAuditLogs({ page, limit: 50 })
      .then((res) => {
        setLogs(res.logs);
        setTotalPages(res.pagination.totalPages);
      })
      .finally(() => setLoading(false));
  }, [page]);

  return (
    <div className="max-w-6xl space-y-5">
      <div>
        <h1 className="text-[1.75rem] font-extrabold tracking-tight text-foreground">Audit Logs</h1>
        <p className="text-sm text-muted-foreground">A record of sensitive actions taken across the system.</p>
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-14" />
          ))}
        </div>
      ) : logs.length === 0 ? (
        <EmptyState icon={<ScrollText className="h-6 w-6" />} title="No activity yet" />
      ) : (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Timestamp</TableHead>
                <TableHead>Actor</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Target</TableHead>
                <TableHead>Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((log) => {
                const meta = ACTION_META[log.action];
                const Icon = meta?.icon ?? ScrollText;
                return (
                  <TableRow key={log._id}>
                    <TableCell className="whitespace-nowrap font-mono-brand text-xs text-muted-foreground">
                      {formatDate(log.createdAt, true)}
                    </TableCell>
                    <TableCell>
                      <span className="font-semibold text-foreground">{log.actorName}</span>{' '}
                      <span className="text-xs text-muted-foreground">({log.actorRole})</span>
                    </TableCell>
                    <TableCell>
                      <span className={cn('inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold', meta?.tone ?? 'bg-secondary text-secondary-foreground')}>
                        <Icon className="h-3.5 w-3.5" />
                        {meta?.label ?? log.action}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{log.targetLabel ?? '-'}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{log.details ?? '-'}</TableCell>
                  </TableRow>
                );
              })}
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
