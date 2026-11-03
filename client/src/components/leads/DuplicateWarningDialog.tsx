import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowUpRight } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { LeadStatusBadge } from './LeadStatusBadge';
import type { DuplicateMatch } from '@/services/lead.service';
import type { LeadStatus } from '@/types';
import { formatDate } from '@/lib/utils';

export function DuplicateWarningDialog({
  open,
  duplicates,
  onCreateAnyway,
  onOpenChange,
}: {
  open: boolean;
  duplicates: DuplicateMatch[];
  onCreateAnyway: () => void;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <div className="mb-1 flex h-11 w-11 items-center justify-center rounded-full bg-warning/20 text-warning-foreground">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <DialogTitle>Possible Existing Customer</DialogTitle>
          <DialogDescription>This mobile number already exists in the system.</DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          {duplicates.map((dup) => (
            <Link
              key={dup._id}
              to={`/agent/leads/${dup._id}`}
              className="flex items-center justify-between gap-3 rounded-xl border border-border bg-secondary/30 p-3.5 transition-colors hover:bg-secondary/60"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-foreground">
                  {dup.customerBasicDetails?.fullName || 'Unnamed customer'}
                </p>
                <p className="font-mono-brand text-xs text-muted-foreground">
                  {dup.leadId} &middot; {formatDate(dup.createdAt)}
                </p>
              </div>
              <div className="flex flex-shrink-0 items-center gap-1.5">
                <LeadStatusBadge status={dup.status as LeadStatus} />
                <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </Link>
          ))}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Go back
          </Button>
          <Button onClick={onCreateAnyway}>Create New Registration Anyway</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
