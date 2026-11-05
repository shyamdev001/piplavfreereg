import { FilterQuery } from 'mongoose';
import { ILead, Lead } from '../models/Lead';
import { UserRole } from '../types/enums';

export interface ListLeadsFilters {
  page: number;
  limit: number;
  search?: string;
  agentId?: string;
  customerType?: string;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
  archived?: boolean;
  isDraft?: boolean;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
}

interface Requester {
  id: string;
  role: UserRole;
}

export function buildLeadFilterQuery(filters: ListLeadsFilters, requester: Requester): FilterQuery<ILead> {
  const query: FilterQuery<ILead> = {};

  // Agents can only ever see their own leads, regardless of what the client sends.
  if (requester.role === UserRole.AGENT) {
    query.createdBy = requester.id;
  } else if (filters.agentId) {
    query.createdBy = filters.agentId;
  }

  query.archived = filters.archived ?? false;
  query.isDraft = filters.isDraft ?? false;

  if (filters.customerType) {
    query['customerBasicDetails.customerType'] = filters.customerType;
  }
  if (filters.status) {
    query.status = filters.status;
  }
  if (filters.dateFrom || filters.dateTo) {
    query.createdAt = {};
    if (filters.dateFrom) query.createdAt.$gte = new Date(filters.dateFrom);
    if (filters.dateTo) {
      const end = new Date(filters.dateTo);
      end.setHours(23, 59, 59, 999);
      query.createdAt.$lte = end;
    }
  }
  if (filters.search) {
    const escaped = filters.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escaped, 'i');
    query.$or = [
      { leadId: regex },
      { 'customerBasicDetails.fullName': regex },
      { 'customerBasicDetails.mobileNumber': regex },
      { 'electricityDetails.consumerNumber': regex },
    ];
  }

  return query;
}

export async function findDuplicateLeadsByMobile(mobileNumber: string, excludeLeadId?: string) {
  const query: FilterQuery<ILead> = {
    'customerBasicDetails.mobileNumber': mobileNumber,
    archived: false,
  };
  if (excludeLeadId) query._id = { $ne: excludeLeadId };

  return Lead.find(query)
    .select('leadId customerBasicDetails.fullName status createdAt')
    .sort({ createdAt: -1 })
    .limit(5)
    .lean();
}

export function canAccessLead(lead: Pick<ILead, 'createdBy'>, requester: Requester): boolean {
  if (requester.role === UserRole.ADMIN || requester.role === UserRole.VIEWER) return true;
  return lead.createdBy.toString() === requester.id;
}
