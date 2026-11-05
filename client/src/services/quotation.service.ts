import { api } from '@/lib/axios';
import type { PaginationMeta } from '@/types';

export type QuotationCategory = 'GENERAL' | 'SC_ST';

export const QUOTATION_CATEGORY_OPTIONS: Array<{ value: QuotationCategory; label: string; amount: number }> = [
  { value: 'GENERAL', label: 'General', amount: 97290 },
  { value: 'SC_ST', label: 'SC/ST', amount: 102695 },
];

export const QUOTATION_CATEGORY_LABEL: Record<QuotationCategory, string> = {
  GENERAL: 'General',
  SC_ST: 'SC/ST',
};

export interface Quotation {
  _id: string;
  quotationNumber: string;
  customerName: string;
  address: string;
  mobileNumber: string;
  category: QuotationCategory;
  amount: number;
  systemSizeKw: number;
  quotationDate: string;
  expiryDate: string;
  createdByName: string;
  createdAt: string;
}

export interface CreateQuotationInput {
  customerName: string;
  address: string;
  mobileNumber: string;
  category: QuotationCategory;
}

export async function createQuotation(input: CreateQuotationInput): Promise<Quotation> {
  const { data } = await api.post('/quotations', input);
  return data.quotation;
}

export async function listQuotations(params: { search?: string; page?: number; limit?: number }): Promise<{
  quotations: Quotation[];
  pagination: PaginationMeta;
}> {
  const { data } = await api.get('/quotations', { params });
  return data;
}

export async function deleteQuotation(id: string): Promise<void> {
  await api.delete(`/quotations/${id}`);
}

/** Same-origin link: the auth cookie goes with it, and the server sends the PDF as a download. */
export function quotationPdfUrl(id: string): string {
  return `/api/quotations/${id}/pdf`;
}

export function downloadQuotationPdf(id: string) {
  const a = document.createElement('a');
  a.href = quotationPdfUrl(id);
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
}
