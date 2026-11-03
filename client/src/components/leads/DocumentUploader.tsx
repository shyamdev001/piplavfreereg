import * as React from 'react';
import {
  Camera,
  Upload,
  CheckCircle2,
  RefreshCw,
  Loader2,
  FileText,
  ImageIcon,
  Eye,
  Trash2,
  IdCard,
  Zap,
  Landmark,
  CreditCard,
  Plus,
  AlertTriangle,
  RotateCw,
  ChevronUp,
  ChevronDown,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import * as documentService from '@/services/document.service';
import type { UploadMode } from '@/services/document.service';
import { getErrorMessage } from '@/lib/axios';
import { cn } from '@/lib/utils';
import { MAX_DOCUMENT_PAGES, documentLabel, sortedPages } from '@/types';
import type { DocumentType, LeadDocument } from '@/types';

const ACCEPTED_TYPES = 'image/jpeg,image/jpg,image/png,image/webp,application/pdf';
const MAX_SIZE_BYTES = 15 * 1024 * 1024;

const DOC_ICONS: Record<DocumentType, React.ComponentType<{ className?: string }>> = {
  'Aadhaar Card': IdCard,
  'Electricity Bill': Zap,
  'Bank Passbook': Landmark,
  'PAN Card': CreditCard,
  'Other Document': FileText,
};

interface DocumentUploaderProps {
  leadId: string;
  documentType: DocumentType;
  existingDocument?: LeadDocument;
  onUploaded: (doc: LeadDocument) => void;
  onDeleted?: () => void;
  required?: boolean;
  /** Replaces the plain document-type title (e.g. with an editable name field). */
  title?: React.ReactNode;
  /** Name sent with the first upload of a new Other Document. */
  customName?: string;
  /** Blocks starting a new upload until it is allowed (e.g. a name is entered). */
  uploadDisabledReason?: string;
}

export function DocumentUploader({
  leadId,
  documentType,
  existingDocument,
  onUploaded,
  onDeleted,
  required,
  title,
  customName,
  uploadDisabledReason,
}: DocumentUploaderProps) {
  const [preview, setPreview] = React.useState<{ file: File; url: string; mode: UploadMode; pageId?: string } | null>(
    null,
  );
  const [uploading, setUploading] = React.useState(false);
  const [progress, setProgress] = React.useState(0);
  const [busyPageId, setBusyPageId] = React.useState<string | null>(null);
  const [retrying, setRetrying] = React.useState(false);
  const cameraInputRef = React.useRef<HTMLInputElement>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const pendingModeRef = React.useRef<UploadMode>('replace');
  const pendingPageIdRef = React.useRef<string | undefined>(undefined);

  const isDone = Boolean(existingDocument) && !preview;
  const Icon = DOC_ICONS[documentType];
  const label = existingDocument ? documentLabel(existingDocument) : customName?.trim() || documentType;
  const pages = existingDocument ? sortedPages(existingDocument) : [];
  const pageCount = pages.length;
  const isPdfOnly = pageCount === 1 && pages[0]?.mimeType === 'application/pdf';
  const canAddPage = isDone && !isPdfOnly && pageCount < MAX_DOCUMENT_PAGES;

  const openPicker = (input: React.RefObject<HTMLInputElement>, mode: UploadMode, pageId?: string) => {
    if (!existingDocument && uploadDisabledReason) {
      toast.error(uploadDisabledReason);
      return;
    }
    pendingModeRef.current = mode;
    pendingPageIdRef.current = pageId;
    input.current?.click();
  };

  const handleFileSelected = (file: File | undefined) => {
    if (!file) return;
    if (!ACCEPTED_TYPES.split(',').includes(file.type)) {
      toast.error('This file type is not supported. Please upload a JPG, PNG, WEBP, or PDF file.');
      return;
    }
    if (file.size > MAX_SIZE_BYTES) {
      toast.error('File is too large. Please choose a file under 15MB.');
      return;
    }
    setPreview({ file, url: URL.createObjectURL(file), mode: pendingModeRef.current, pageId: pendingPageIdRef.current });
  };

  const confirmUpload = async () => {
    if (!preview) return;
    setUploading(true);
    setProgress(0);
    try {
      const doc = await documentService.uploadDocument(
        leadId,
        preview.file,
        documentType,
        preview.mode,
        setProgress,
        preview.pageId,
        { documentId: existingDocument?._id, customName: existingDocument ? undefined : customName?.trim() },
      );
      onUploaded(doc);
      setPreview(null);
      if (doc.pdfStatus === 'FAILED') {
        toast.warning(`${label} saved, but PDF generation failed. You can retry it below.`);
      } else if (preview.mode === 'append') {
        toast.success('Page added.');
      } else if (preview.mode === 'replace-page') {
        toast.success('Page replaced.');
      } else {
        toast.success(`${label} uploaded.`);
      }
    } catch (err) {
      toast.error(getErrorMessage(err, 'Upload failed. Your other information is still saved.'));
    } finally {
      setUploading(false);
    }
  };

  const handlePreviewPage = async (index: number) => {
    if (!existingDocument) return;
    const key = `preview-${index}`;
    setBusyPageId(key);
    try {
      const readyAsPdf = existingDocument.pdfStatus === 'READY';
      const { url } = await documentService.getDocumentAccessUrl(existingDocument._id, {
        action: 'view',
        variant: readyAsPdf ? 'pdf' : 'original',
        index,
      });
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      toast.error(getErrorMessage(err, 'Unable to open this page right now.'));
    } finally {
      setBusyPageId(null);
    }
  };

  const handleMovePage = async (index: number, direction: -1 | 1) => {
    if (!existingDocument) return;
    const target = index + direction;
    if (target < 0 || target >= pages.length) return;
    const reordered = [...pages];
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
    const pageIds = reordered.map((p) => p._id);

    setBusyPageId(pages[index]._id);
    try {
      const doc = await documentService.reorderPages(existingDocument._id, pageIds);
      onUploaded(doc);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Unable to reorder pages.'));
    } finally {
      setBusyPageId(null);
    }
  };

  const handleRemovePage = async (pageId: string) => {
    if (!existingDocument) return;
    setBusyPageId(pageId);
    try {
      const doc = await documentService.removePage(existingDocument._id, pageId);
      if (doc) {
        onUploaded(doc);
        toast.success('Page removed.');
      } else {
        onDeleted?.();
        toast.success('Document removed.');
      }
    } catch (err) {
      toast.error(getErrorMessage(err, 'Unable to remove this page.'));
    } finally {
      setBusyPageId(null);
    }
  };

  const handleRetry = async () => {
    if (!existingDocument) return;
    setRetrying(true);
    try {
      const doc = await documentService.regeneratePdf(existingDocument._id);
      onUploaded(doc);
      if (doc.pdfStatus === 'READY') toast.success('PDF generated successfully.');
      else toast.error('PDF generation failed again. The original file is still safe.');
    } catch (err) {
      toast.error(getErrorMessage(err, 'Unable to retry PDF generation.'));
    } finally {
      setRetrying(false);
    }
  };

  const handleRemoveAll = async () => {
    if (!existingDocument) return;
    try {
      await documentService.deleteDocument(existingDocument._id);
      onDeleted?.();
      toast.success('Document removed.');
    } catch (err) {
      toast.error(getErrorMessage(err, 'Unable to remove this document.'));
    }
  };

  return (
    <div
      className={cn(
        'rounded-2xl border p-4 transition-colors duration-200',
        isDone && existingDocument?.pdfStatus === 'READY'
          ? 'border-success/25 bg-success/[0.04]'
          : isDone && existingDocument?.pdfStatus === 'FAILED'
            ? 'border-warning/40 bg-warning/[0.05]'
            : 'border-border bg-card',
      )}
    >
      <div className="mb-3.5 flex items-center gap-3">
        <div
          className={cn(
            'flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl',
            isDone ? 'bg-success/12 text-success' : 'bg-primary/10 text-primary',
          )}
        >
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          {title ?? (
            <p className="text-sm font-bold text-foreground">
              {documentType}
              {required && <span className="ml-1 text-primary">*</span>}
            </p>
          )}
          {isDone && existingDocument && (
            <span
              className={cn(
                'flex items-center gap-1 text-xs font-semibold',
                existingDocument.pdfStatus === 'READY' && 'text-success',
                existingDocument.pdfStatus === 'PROCESSING' && 'text-accent-foreground',
                existingDocument.pdfStatus === 'FAILED' && 'text-warning-foreground',
              )}
            >
              {existingDocument.pdfStatus === 'READY' && <CheckCircle2 className="h-3 w-3" />}
              {existingDocument.pdfStatus === 'PROCESSING' && <Loader2 className="h-3 w-3 animate-spin" />}
              {existingDocument.pdfStatus === 'FAILED' && <AlertTriangle className="h-3 w-3" />}
              {existingDocument.pdfStatus === 'READY' && 'PDF Ready'}
              {existingDocument.pdfStatus === 'PROCESSING' && 'Generating PDF...'}
              {existingDocument.pdfStatus === 'FAILED' && 'PDF generation failed'}
              {pageCount > 1 && ` · ${pageCount} pages`}
            </span>
          )}
        </div>
      </div>

      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => handleFileSelected(e.target.files?.[0])}
      />
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPTED_TYPES}
        className="hidden"
        onChange={(e) => handleFileSelected(e.target.files?.[0])}
      />

      {preview ? (
        <div className="space-y-3">
          <div className="flex items-center gap-3 rounded-xl bg-secondary/60 p-3">
            {preview.file.type.startsWith('image/') ? (
              <img src={preview.url} alt="Preview" className="h-16 w-16 rounded-lg object-cover shadow-warm-sm" />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-secondary">
                <FileText className="h-6 w-6 text-muted-foreground" />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{preview.file.name}</p>
              <p className="text-xs text-muted-foreground">
                {(preview.file.size / 1024 / 1024).toFixed(1)} MB
                {preview.mode === 'append' && ' · Adding as a new page'}
                {preview.mode === 'replace-page' && ' · Replacing this page'}
              </p>
            </div>
          </div>

          {uploading && <Progress value={progress} />}

          <div className="flex gap-2">
            <Button type="button" size="sm" className="flex-1" onClick={confirmUpload} loading={uploading}>
              {uploading ? 'Uploading...' : 'Looks good'}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="flex-1"
              disabled={uploading}
              onClick={() => setPreview(null)}
            >
              <RefreshCw className="h-4 w-4" /> Choose Different File
            </Button>
          </div>
        </div>
      ) : existingDocument ? (
        <div className="space-y-2.5">
          {existingDocument.pdfStatus === 'FAILED' && (
            <Button type="button" size="sm" variant="outline" className="w-full" onClick={handleRetry} loading={retrying}>
              {!retrying && (
                <>
                  <RotateCw className="h-4 w-4" /> Retry PDF Generation
                </>
              )}
            </Button>
          )}

          <div className="space-y-2">
            {pages.map((page, index) => {
              const pageBusy = busyPageId === page._id;
              return (
                <div
                  key={page._id}
                  className="flex items-center gap-2.5 rounded-xl border border-border bg-secondary/20 p-2.5"
                >
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-secondary text-muted-foreground">
                    {page.mimeType === 'application/pdf' ? (
                      <FileText className="h-4.5 w-4.5" />
                    ) : (
                      <ImageIcon className="h-4.5 w-4.5" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-foreground">Page {page.pageNumber}</p>
                    <p className="truncate text-[11px] text-muted-foreground">{page.originalName}</p>
                  </div>
                  <div className="flex flex-shrink-0 items-center gap-0.5">
                    {pageCount > 1 && (
                      <>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          disabled={index === 0 || pageBusy}
                          onClick={() => handleMovePage(index, -1)}
                          aria-label="Move page up"
                        >
                          <ChevronUp className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          disabled={index === pageCount - 1 || pageBusy}
                          onClick={() => handleMovePage(index, 1)}
                          aria-label="Move page down"
                        >
                          <ChevronDown className="h-3.5 w-3.5" />
                        </Button>
                      </>
                    )}
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      disabled={busyPageId === `preview-${index}`}
                      onClick={() => handlePreviewPage(index)}
                      aria-label="Preview page"
                    >
                      {busyPageId === `preview-${index}` ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Eye className="h-3.5 w-3.5" />
                      )}
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      disabled={pageBusy}
                      onClick={() => openPicker(cameraInputRef, 'replace-page', page._id)}
                      aria-label="Retake page"
                    >
                      <Camera className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-destructive hover:bg-destructive/10 hover:text-destructive"
                      disabled={pageBusy}
                      onClick={() => handleRemovePage(page._id)}
                      aria-label="Remove page"
                    >
                      {pageBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {canAddPage && (
              <Button type="button" size="sm" variant="outline" onClick={() => openPicker(cameraInputRef, 'append')}>
                <Plus className="h-4 w-4" /> Add Another Photo
              </Button>
            )}
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={handleRemoveAll}
            >
              <Trash2 className="h-4 w-4" /> Remove Document
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button type="button" className="flex-1" onClick={() => openPicker(cameraInputRef, 'replace')}>
            <Camera className="h-4 w-4" /> Take Photo
          </Button>
          <Button type="button" variant="outline" className="flex-1" onClick={() => openPicker(fileInputRef, 'replace')}>
            <Upload className="h-4 w-4" /> Upload From Device
          </Button>
        </div>
      )}
    </div>
  );
}
