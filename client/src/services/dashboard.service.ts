import { api } from '@/lib/axios';
import type { Lead } from '@/types';

export interface AdminDashboardStats {
  totalLeads: number;
  todaysLeads: number;
  residential: number;
  commercial: number;
  totalAgents: number;
  byStatus: Record<string, number>;
}

export interface AgentDashboardStats {
  total: number;
  today: number;
  drafts: number;
  recentLeads: Pick<Lead, '_id' | 'leadId' | 'customerBasicDetails' | 'status' | 'createdAt'>[];
}

export async function getAdminDashboardStats(): Promise<AdminDashboardStats> {
  const { data } = await api.get('/dashboard/stats');
  return data;
}

export async function getAgentDashboardStats(): Promise<AgentDashboardStats> {
  const { data } = await api.get('/dashboard/agent-stats');
  return data;
}
