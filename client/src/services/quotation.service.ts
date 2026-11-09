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
  /** STANDARD: main form (Piplav/Other, add-ons). STAFF: other village with the policy tick. */
  kind?: 'STANDARD' | 'STAFF';
  /** Staff quotations: false = policy not included. */
  policyIncluded?: boolean;
  category: QuotationCategory;
  basePrice?: number;
  systemPrice?: number;
  extras?: Array<{ name: string; description?: string; price: number; includedInPrice?: boolean }>;
  amount: number;
  systemSizeKw: number;
  quotationDate: string;
  expiryDate: string;
  createdByName: string;
  updatedByName?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface CreateQuotationInput {
  customerName: string;
  address: string;
  mobileNumber: string;
  village?: QuotationVillage;
  category: QuotationCategory;
  /** Staff quotations only. */
  policyIncluded?: boolean;
  /** Ticked add-ons with the amount for this customer. */
  extras: Array<{ id: string; price: number }>;
}

/**
 * Optional add-on (e.g. a policy). `price` is only the default amount: it is typed per quotation
 * and taken out of the panels + inverter price, so the total stays fixed.
 */
export interface QuotationExtra {
  _id: string;
  name: string;
  description?: string;
  price: number;
  active: boolean;
}

export type QuotationExtraInput = Pick<QuotationExtra, 'name' | 'price'> & {
  description?: string;
  active?: boolean;
};

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

/** Staff quotations: other village, Rs 700 policy ticked by default. Keep in step with the server config. */
export const STAFF_POLICY_PRICE = 700;
export const STAFF_CATEGORY_OPTIONS = QUOTATION_CATEGORY_OPTIONS.OTHER;

/** Ticked: policy is inside the fixed total. Unticked: the policy amount comes off the total. */
export function staffQuotationTotal(category: QuotationCategory, policyIncluded: boolean) {
  const base = STAFF_CATEGORY_OPTIONS.find((o) => o.value === category)?.amount ?? 0;
  const systemPrice = base - STAFF_POLICY_PRICE;
  return { systemPrice, total: policyIncluded ? base : systemPrice };
}

export type UpdateQuotationInput = Partial<{
  customerName: string;
  address: string;
  mobileNumber: string;
  category: QuotationCategory;
  policyIncluded: boolean;
}>;

export async function updateQuotation(id: string, input: UpdateQuotationInput): Promise<Quotation> {
  const { data } = await api.patch(`/quotations/${id}`, input);
  return data.quotation;
}

// ---- History ----

export type QuotationHistoryAction = 'QUOTATION_CREATED' | 'QUOTATION_UPDATED' | 'QUOTATION_DOWNLOADED' | 'QUOTATION_DELETED';

export interface QuotationHistoryEntry {
  _id: string;
  action: QuotationHistoryAction;
  actorId: string;
  actorName: string;
  actorRole: string;
  targetId?: string;
  targetLabel?: string;
  details?: string;
  createdAt: string;
}

export interface QuotationHistoryFilters {
  actorId?: string;
  targetId?: string;
  action?: QuotationHistoryAction;
  search?: string;
  /** YYYY-MM-DD */
  from?: string;
  to?: string;
}

export async function listQuotationHistory(params: QuotationHistoryFilters & { page?: number; limit?: number }): Promise<{
  logs: QuotationHistoryEntry[];
  pagination: PaginationMeta;
}> {
  const { data } = await api.get('/quotations/history', { params });
  return data;
}

/** Same-origin link (the auth cookie goes with it); the server sends a CSV that opens in Excel. */
export function quotationHistoryExportUrl(filters: QuotationHistoryFilters): string {
  const qs = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value) qs.set(key, value);
  });
  const query = qs.toString();
  return `/api/quotations/history/export${query ? `?${query}` : ''}`;
}

export async function listQuotations(params: { search?: string; createdBy?: string; page?: number; limit?: number }): Promise<{
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
