import { api } from '@/lib/axios';
import type { DocumentType, LeadDocument } from '@/types';

export type UploadMode = 'replace' | 'append' | 'replace-page';

export async function uploadDocument(
  leadId: string,
  file: File,
  documentType: DocumentType,
  mode: UploadMode = 'replace',
  onProgress?: (percent: number) => void,
  pageId?: string,
  target: { documentId?: string; customName?: string } = {},
): Promise<LeadDocument> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('documentType', documentType);
  formData.append('mode', mode);
  if (mode === 'replace-page' && pageId) formData.append('pageId', pageId);
  // documentId targets one specific document (needed when a lead has several
  // Other Documents); customName names a brand-new Other Document.
  if (target.documentId) formData.append('documentId', target.documentId);
  if (target.customName) formData.append('customName', target.customName);

  const { data } = await api.post(`/leads/${leadId}/documents`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: (evt) => {
      if (onProgress && evt.total) onProgress(Math.round((evt.loaded / evt.total) * 100));
    },
  });
  return data.document;
}

export async function getDocumentAccessUrl(
  documentId: string,
  opts: { action?: 'view' | 'download'; variant?: 'pdf' | 'original'; index?: number } = {},
): Promise<{ url: string }> {
  const { action = 'view', variant = 'pdf', index = 0 } = opts;
  const { data } = await api.get(`/documents/${documentId}/access`, { params: { action, variant, index } });
  return data;
}

export async function regeneratePdf(documentId: string): Promise<LeadDocument> {
  const { data } = await api.post(`/documents/${documentId}/regenerate-pdf`);
  return data.document;
}

export async function renameDocument(documentId: string, customName: string): Promise<LeadDocument> {
  const { data } = await api.patch(`/documents/${documentId}`, { customName });
  return data.document;
}

export async function deleteDocument(documentId: string): Promise<void> {
  await api.delete(`/documents/${documentId}`);
}

/** Returns null if the whole document group was deleted (its only page was removed). */
export async function removePage(documentId: string, pageId: string): Promise<LeadDocument | null> {
  const { data } = await api.delete(`/documents/${documentId}/pages/${pageId}`);
  return data.document ?? null;
}

export async function reorderPages(documentId: string, pageIds: string[]): Promise<LeadDocument> {
  const { data } = await api.patch(`/documents/${documentId}/pages/reorder`, { pageIds });
  return data.document;
}

export function downloadAllPdfsUrl(leadId: string): string {
  return `/api/leads/${leadId}/documents/download-all`;
}
