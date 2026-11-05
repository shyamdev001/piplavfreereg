import { api } from '@/lib/axios';
import type { Agent } from '@/types';

export async function listAgents(): Promise<Agent[]> {
  const { data } = await api.get('/agents');
  return data.agents;
}

export async function getAgent(id: string): Promise<Agent> {
  const { data } = await api.get(`/agents/${id}`);
  return data.agent;
}

export async function createAgent(payload: {
  name: string;
  email: string;
  phone: string;
  password: string;
  role: 'AGENT' | 'VIEWER' | 'QUOTATION';
}): Promise<{ agent: Agent }> {
  const { data } = await api.post('/agents', payload);
  return data;
}

export async function updateAgent(id: string, payload: { name?: string; phone?: string }): Promise<Agent> {
  const { data } = await api.patch(`/agents/${id}`, payload);
  return data.agent;
}

export async function updateAgentStatus(id: string, status: 'ACTIVE' | 'DISABLED'): Promise<void> {
  await api.patch(`/agents/${id}/status`, { status });
}

export async function resetAgentCredentials(id: string, newPassword: string): Promise<void> {
  await api.post(`/agents/${id}/reset-credentials`, { newPassword });
}

export async function getAgentStats(id: string): Promise<{ total: number; today: number; byStatus: Record<string, number> }> {
  const { data } = await api.get(`/agents/${id}/stats`);
  return data;
}
