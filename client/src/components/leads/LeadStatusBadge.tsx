import { cn } from '@/lib/utils';
import type { LeadStatus } from '@/types';

// Deliberately mapped to the brand's semantic palette rather than arbitrary
// hues, so status color stays consistent with the rest of the design system.
const STATUS_STYLES: Record<LeadStatus, string> = {
  NEW: 'bg-info/12 text-info',
  CONTACTED: 'bg-secondary text-secondary-foreground',
  QUALIFIED: 'bg-premium/12 text-premium',
  QUOTATION: 'bg-accent/18 text-accent-foreground',
  'FOLLOW-UP': 'bg-primary/12 text-primary',
  CONVERTED: 'bg-success/12 text-success',
  LOST: 'bg-destructive/12 text-destructive',
  ARCHIVED: 'bg-muted text-muted-foreground',
};

export const STATUS_DOT: Record<LeadStatus, string> = {
  NEW: 'bg-info',
  CONTACTED: 'bg-secondary-foreground/50',
  QUALIFIED: 'bg-premium',
  QUOTATION: 'bg-accent',
  'FOLLOW-UP': 'bg-primary',
  CONVERTED: 'bg-success',
  LOST: 'bg-destructive',
  ARCHIVED: 'bg-muted-foreground/60',
};

export function LeadStatusBadge({ status, className }: { status: LeadStatus; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.7rem] font-bold uppercase tracking-wide',
        STATUS_STYLES[status],
        className,
      )}
    >
      <span className={cn('h-1.5 w-1.5 flex-shrink-0 rounded-full', STATUS_DOT[status])} />
      {status}
    </span>
  );
}
