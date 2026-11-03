import { api } from '@/lib/axios';
import type { Lead, PaginationMeta } from '@/types';

export interface LeadListParams {
  page?: number;
  limit?: number;
  search?: string;
  agentId?: string;
  customerType?: string;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
  archived?: boolean;
  isDraft?: boolean;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export async function listLeads(params: LeadListParams): Promise<{ leads: Lead[]; pagination: PaginationMeta }> {
  const { data } = await api.get('/leads', { params });
  return data;
}

export async function getLead(id: string): Promise<Lead> {
  const { data } = await api.get(`/leads/${id}`);
  return data.lead;
}

export async function createDraftLead(payload: Partial<Lead> = {}): Promise<Lead> {
  const { data } = await api.post('/leads', payload);
  return data.lead;
}

export async function updateLead(id: string, payload: Record<string, unknown>): Promise<Lead> {
  const { data } = await api.patch(`/leads/${id}`, payload);
  return data.lead;
}

export async function submitLead(id: string): Promise<Lead> {
  const { data } = await api.post(`/leads/${id}/submit`);
  return data.lead;
}

export async function deleteDraftLead(id: string): Promise<void> {
  await api.delete(`/leads/${id}`);
}

export async function updateLeadStatus(id: string, status: string): Promise<Lead> {
  const { data } = await api.patch(`/leads/${id}/status`, { status });
  return data.lead;
}

export async function archiveLead(id: string): Promise<Lead> {
  const { data } = await api.post(`/leads/${id}/archive`);
  return data.lead;
}

export async function restoreLead(id: string): Promise<Lead> {
  const { data } = await api.post(`/leads/${id}/restore`);
  return data.lead;
}

export interface DuplicateMatch {
  leadId: string;
  customerBasicDetails?: { fullName?: string };
  status: string;
  createdAt: string;
  _id: string;
}

export async function checkDuplicateLead(mobileNumber: string): Promise<{ hasDuplicates: boolean; duplicates: DuplicateMatch[] }> {
  const { data } = await api.get('/leads/duplicates', { params: { mobileNumber } });
  return data;
}

export function exportLeadsUrl(params: LeadListParams): string {
  const query = new URLSearchParams(params as Record<string, string>).toString();
  return `/api/leads/export?${query}`;
}
