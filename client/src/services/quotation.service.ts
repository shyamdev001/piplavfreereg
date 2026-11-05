import { api } from '@/lib/axios';
import type { PaginationMeta } from '@/types';

export type QuotationVillage = 'PIPLAV' | 'OTHER';
export type QuotationCategory = 'GENERAL' | 'SC_ST' | 'PASHUPALAK';

export const QUOTATION_VILLAGE_LABEL: Record<QuotationVillage, string> = {
  PIPLAV: 'Piplav',
  OTHER: 'Other village',
};

/** Same prices as the server (the server decides the final amount). */
export const QUOTATION_CATEGORY_OPTIONS: Record<
  QuotationVillage,
  Array<{ value: QuotationCategory; label: string; amount: number }>
> = {
  PIPLAV: [
    { value: 'GENERAL', label: 'General', amount: 97290 },
    { value: 'SC_ST', label: 'SC/ST', amount: 102695 },
  ],
  OTHER: [
    { value: 'GENERAL', label: 'General', amount: 110700 },
    { value: 'PASHUPALAK', label: 'Pashupalak', amount: 108700 },
  ],
};

export const QUOTATION_CATEGORY_LABEL: Record<QuotationCategory, string> = {
  GENERAL: 'General',
  SC_ST: 'SC/ST',
  PASHUPALAK: 'Pashupalak',
};

export interface Quotation {
  _id: string;
  quotationNumber: string;
  customerName: string;
  address: string;
  mobileNumber: string;
  village?: QuotationVillage;
  category: QuotationCategory;
  basePrice?: number;
  extras?: Array<{ name: string; description?: string; price: number }>;
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
  village: QuotationVillage;
  category: QuotationCategory;
  extraIds: string[];
}

/** Optional add-on (Insurance, WiFi dongle, ...) that admins price and quotations can include. */
export interface QuotationExtra {
  _id: string;
  name: string;
  description?: string;
  price: number;
  active: boolean;
}

export type QuotationExtraInput = Pick<QuotationExtra, 'name' | 'price'> & { description?: string; active?: boolean };

/** Admins get every add-on; other roles only the active ones. */
export async function listExtras(): Promise<QuotationExtra[]> {
  const { data } = await api.get('/quotations/extras');
  return data.extras;
}

export async function createExtra(input: QuotationExtraInput): Promise<QuotationExtra> {
  const { data } = await api.post('/quotations/extras', input);
  return data.extra;
}

export async function updateExtra(id: string, input: Partial<QuotationExtraInput>): Promise<QuotationExtra> {
  const { data } = await api.patch(`/quotations/extras/${id}`, input);
  return data.extra;
}

export async function deleteExtra(id: string): Promise<void> {
  await api.delete(`/quotations/extras/${id}`);
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
export function quotationPdfUrl(id: string, inline = false): string {
  return `/api/quotations/${id}/pdf${inline ? '?inline=1' : ''}`;
}

export function downloadQuotationPdf(id: string) {
  const a = document.createElement('a');
  a.href = quotationPdfUrl(id);
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
}
