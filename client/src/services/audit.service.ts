import { api } from '@/lib/axios';
import type { AuditLogEntry, PaginationMeta } from '@/types';

export async function listAuditLogs(params: { page?: number; limit?: number; targetId?: string } = {}) {
  const { data } = await api.get('/audit-logs', { params });
  return data as { logs: AuditLogEntry[]; pagination: PaginationMeta };
}
