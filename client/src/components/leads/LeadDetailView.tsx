import * as React from 'react';
import {
  Eye,
  Download,
  Loader2,
  FileWarning,
  User,
  MapPin,
  Sun,
  Zap,
  StickyNote,
  History,
  Phone,
  CheckCircle2,
  AlertTriangle,
  RotateCw,
  FileArchive,
  ChevronDown,
} from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import { LeadStatusBadge } from './LeadStatusBadge';
import * as documentService from '@/services/document.service';
import { getErrorMessage } from '@/lib/axios';
import { cn, formatDate, initials } from '@/lib/utils';
import { documentLabel, sortedPages } from '@/types';
import type { Lead, LeadDocument } from '@/types';

function InfoRow({ label, value }: { label: string; value?: React.ReactNode }) {
  if (value === undefined || value === null || value === '') return null;
  return (
    <div className="flex justify-between gap-4 py-2 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-semibold text-foreground">{value}</span>
    </div>
  );
}

function SectionCard({
  icon: Icon,
  title,
  action,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-2.5 space-y-0">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Icon className="h-4 w-4" />
          </div>
          <CardTitle>{title}</CardTitle>
        </div>
        {action}
      </CardHeader>
      <CardContent className="divide-y divide-border/70">{children}</CardContent>
    </Card>
  );
}

const PDF_STATUS_META: Record<string, { label: string; className: string; icon: React.ComponentType<{ className?: string }> }> = {
  READY: { label: 'PDF Ready', className: 'bg-success/12 text-success', icon: CheckCircle2 },
  PROCESSING: { label: 'Generating PDF...', className: 'bg-accent/18 text-accent-foreground', icon: Loader2 },
  FAILED: { label: 'PDF generation failed', className: 'bg-warning/20 text-warning-foreground', icon: AlertTriangle },
};

function DocumentRow({
  doc,
  canDownload,
  onUpdated,
}: {
  doc: LeadDocument;
  canDownload: boolean;
  onUpdated: (doc: LeadDocument) => void;
}) {
  const [busy, setBusy] = React.useState<string | null>(null);
  const statusMeta = PDF_STATUS_META[doc.pdfStatus] ?? PDF_STATUS_META.PROCESSING;
  const StatusIcon = statusMeta.icon;
  const pages = sortedPages(doc);
  const pageCount = pages.length;

  const openAsset = async (key: string, opts: { action: 'view' | 'download'; variant: 'pdf' | 'original'; index?: number }) => {
    setBusy(key);
    try {
      const { url } = await documentService.getDocumentAccessUrl(doc._id, opts);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      toast.error(getErrorMessage(err, 'Unable to access this document.'));
    } finally {
      setBusy(null);
    }
  };

  const handleRetry = async () => {
    setBusy('retry');
    try {
      const updated = await documentService.regeneratePdf(doc._id);
      onUpdated(updated);
      toast.success(updated.pdfStatus === 'READY' ? 'PDF regenerated.' : 'PDF generation failed again. The original file is still safe.');
    } catch (err) {
      toast.error(getErrorMessage(err, 'Unable to regenerate the PDF.'));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-2.5 rounded-xl border border-border bg-secondary/20 p-3.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-bold text-foreground">{documentLabel(doc)}</p>
        <span className={cn('flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold', statusMeta.className)}>
          <StatusIcon className={cn('h-3.5 w-3.5', doc.pdfStatus === 'PROCESSING' && 'animate-spin')} />
          {statusMeta.label}
          {pageCount > 1 && ` · ${pageCount} pages`}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant="outline"
          disabled={busy !== null}
          onClick={() => openAsset('preview', { action: 'view', variant: doc.pdfStatus === 'READY' ? 'pdf' : 'original' })}
        >
          {busy === 'preview' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />} Preview
        </Button>

        {doc.pdfStatus === 'READY' && canDownload && (
          <Button
            size="sm"
            variant="outline"
            disabled={busy !== null}
            onClick={() => openAsset('pdf', { action: 'download', variant: 'pdf' })}
          >
            {busy === 'pdf' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Download PDF
          </Button>
        )}

        {canDownload &&
          (pageCount > 1 ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="outline" disabled={busy !== null}>
                  <Download className="h-4 w-4" /> Download Original <ChevronDown className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                {pages.map((page, i) => (
                  <DropdownMenuItem key={page._id} onClick={() => openAsset(`orig-${i}`, { action: 'download', variant: 'original', index: i })}>
                    Page {page.pageNumber} &middot; {page.originalName}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            pageCount === 1 && (
              <Button
                size="sm"
                variant="outline"
                disabled={busy !== null}
                onClick={() => openAsset('orig-0', { action: 'download', variant: 'original', index: 0 })}
              >
                {busy === 'orig-0' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Download Original
              </Button>
            )
          ))}

        {doc.pdfStatus === 'FAILED' && (
          <Button size="sm" variant="outline" disabled={busy !== null} onClick={handleRetry}>
            {busy === 'retry' ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCw className="h-4 w-4" />} Retry
          </Button>
        )}
      </div>
    </div>
  );
}

export function LeadDetailView({
  lead,
  canDownloadDocuments = false,
  headerActions,
}: {
  lead: Lead;
  canDownloadDocuments?: boolean;
  headerActions?: React.ReactNode;
}) {
  const [documents, setDocuments] = React.useState<LeadDocument[]>(lead.documents);
  const [downloadingAll, setDownloadingAll] = React.useState(false);
  const createdByName = typeof lead.createdBy === 'object' ? lead.createdBy.name : undefined;

  // Keep in sync if the parent hands us a freshly-fetched lead (e.g. navigating
  // between leads), while still allowing in-place updates (like a PDF retry)
  // to reflect immediately without a full re-fetch.
  React.useEffect(() => {
    setDocuments(lead.documents);
  }, [lead]);

  const handleDocumentUpdated = (updated: LeadDocument) => {
    setDocuments((prev) => prev.map((d) => (d._id === updated._id ? updated : d)));
  };

  const readyCount = documents.filter((d) => d.pdfStatus === 'READY').length;
  const totalCount = documents.length;

  const handleDownloadAll = async () => {
    setDownloadingAll(true);
    try {
      if (readyCount < totalCount) {
        const notReady = documents.filter((d) => d.pdfStatus !== 'READY').map(documentLabel);
        toast.warning(`Downloading ${readyCount} of ${totalCount} PDFs. Not ready yet: ${notReady.join(', ')}.`);
      }
      window.open(documentService.downloadAllPdfsUrl(lead._id), '_blank');
    } finally {
      setDownloadingAll(false);
    }
  };

  return (
    <div className="space-y-5">
      <Card className="overflow-hidden">
        <div className={cn('bg-sunrise-deep p-5 text-primary-foreground sm:p-6')}>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <span className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-white/20 text-base font-extrabold backdrop-blur-sm sm:h-14 sm:w-14 sm:text-lg">
                {initials(lead.customerBasicDetails?.fullName || '?')}
              </span>
              <div className="min-w-0">
                <p className="font-mono-brand text-xs font-bold uppercase tracking-wider text-primary-foreground/70">
                  {lead.leadId}
                </p>
                <p className="truncate text-lg font-extrabold leading-tight sm:text-xl">
                  {lead.customerBasicDetails?.fullName || 'Unnamed customer'}
                </p>
                <p className="flex items-center gap-1 text-sm text-primary-foreground/85">
                  <Phone className="h-3.5 w-3.5" /> {lead.customerBasicDetails?.mobileNumber || '-'}
                </p>
              </div>
            </div>
            <div className="flex flex-shrink-0 items-center gap-2">
              <LeadStatusBadge status={lead.status} className="bg-white/20 text-primary-foreground" />
            </div>
          </div>
        </div>
        {headerActions && <div className="flex flex-wrap items-center gap-2 border-t border-border/70 p-4">{headerActions}</div>}
      </Card>

      <SectionCard icon={User} title="Customer Basic Details">
        <InfoRow label="Full Name" value={lead.customerBasicDetails?.fullName} />
        <InfoRow label="Father / Husband Name" value={lead.customerBasicDetails?.fatherHusbandName} />
        <InfoRow label="Mobile Number" value={lead.customerBasicDetails?.mobileNumber} />
        <InfoRow label="Alternate Mobile" value={lead.customerBasicDetails?.alternateMobileNumber} />
        <InfoRow label="Email" value={lead.customerBasicDetails?.email} />
        <InfoRow label="Customer Type" value={lead.customerBasicDetails?.customerType} />
      </SectionCard>

      <SectionCard icon={MapPin} title="Customer Address">
        <InfoRow label="Full Address" value={lead.customerAddress?.fullAddress} />
        <InfoRow label="City / Village" value={lead.customerAddress?.cityVillage} />
        <InfoRow label="District" value={lead.customerAddress?.district} />
        <InfoRow label="State" value={lead.customerAddress?.state} />
        <InfoRow label="PIN Code" value={lead.customerAddress?.pincode} />
      </SectionCard>

      <SectionCard icon={Sun} title="Solar Information">
        <InfoRow label="System Size" value={lead.solarInformation?.requiredSystemSizeKw ? `${lead.solarInformation.requiredSystemSizeKw} kW` : undefined} />
      </SectionCard>

      <SectionCard icon={Zap} title="Electricity Details">
        <InfoRow label="Electricity Consumer Name" value={lead.electricityDetails?.consumerName} />
        <InfoRow label="Consumer Number" value={lead.electricityDetails?.consumerNumber} />
      </SectionCard>

      <SectionCard
        icon={FileWarning}
        title="Customer Documents"
        action={
          canDownloadDocuments &&
          documents.length > 0 && (
            <Button size="sm" variant="outline" onClick={handleDownloadAll} loading={downloadingAll}>
              {!downloadingAll && (
                <>
                  <FileArchive className="h-4 w-4" /> Download All PDFs
                </>
              )}
            </Button>
          )
        }
      >
        {documents.length === 0 ? (
          <div className="flex items-center gap-2 rounded-xl bg-secondary/30 p-3.5 text-sm text-muted-foreground">
            <FileWarning className="h-4 w-4" /> No documents uploaded yet.
          </div>
        ) : (
          <div className="space-y-2.5 py-2">
            {documents.map((doc) => (
              <DocumentRow key={doc._id} doc={doc} canDownload={canDownloadDocuments} onUpdated={handleDocumentUpdated} />
            ))}
          </div>
        )}
      </SectionCard>

      {lead.notes && (
        <SectionCard icon={StickyNote} title="Notes">
          <p className="whitespace-pre-wrap py-2 text-sm text-foreground">{lead.notes}</p>
        </SectionCard>
      )}

      <SectionCard icon={History} title="Collection Information">
        <InfoRow label="Registration ID" value={<span className="font-mono-brand">{lead.leadId}</span>} />
        {createdByName && <InfoRow label="Created By" value={createdByName} />}
        <InfoRow label="Created Date" value={formatDate(lead.createdAt, true)} />
        <InfoRow label="Last Updated" value={formatDate(lead.updatedAt, true)} />
        <InfoRow label="Current Status" value={<LeadStatusBadge status={lead.status} />} />
      </SectionCard>
    </div>
  );
}
