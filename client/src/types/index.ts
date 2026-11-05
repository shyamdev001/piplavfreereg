export type UserRole = 'ADMIN' | 'AGENT' | 'VIEWER' | 'QUOTATION';

/** Where each role lands after login: viewers share the (read-only) admin screens. */
export function homePathFor(role: UserRole): string {
  if (role === 'AGENT') return '/agent';
  if (role === 'QUOTATION') return '/quotations';
  return '/admin';
}
export type UserStatus = 'ACTIVE' | 'DISABLED';
export type CustomerType = 'Residential' | 'Commercial';
export type LeadStatus =
  | 'NEW'
  | 'CONTACTED'
  | 'QUALIFIED'
  | 'QUOTATION'
  | 'FOLLOW-UP'
  | 'CONVERTED'
  | 'LOST'
  | 'ARCHIVED';
export type DocumentType = 'Aadhaar Card' | 'Electricity Bill' | 'Bank Passbook' | 'PAN Card' | 'Other Document';

export const LEAD_STATUSES: LeadStatus[] = [
  'NEW',
  'CONTACTED',
  'QUALIFIED',
  'QUOTATION',
  'FOLLOW-UP',
  'CONVERTED',
  'LOST',
  'ARCHIVED',
];

export const DOCUMENT_TYPES: DocumentType[] = [
  'Aadhaar Card',
  'Electricity Bill',
  'Bank Passbook',
  'PAN Card',
  'Other Document',
];

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  phone?: string;
  mustChangePassword?: boolean;
}

export interface Agent {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: 'AGENT' | 'VIEWER' | 'QUOTATION';
  status: UserStatus;
  createdAt: string;
  totalLeads: number;
}

export type PdfStatus = 'NOT_READY' | 'PROCESSING' | 'READY' | 'FAILED';

export interface DocumentPage {
  _id: string;
  pageNumber: number;
  cloudinaryPublicId: string;
  resourceType: string;
  mimeType: string;
  originalName: string;
  fileSize: number;
  uploadedAt: string;
}

export interface PdfFile {
  cloudinaryPublicId: string;
  resourceType: string;
  fileSize: number;
  generatedAt: string;
}

export interface LeadDocument {
  _id: string;
  documentType: DocumentType;
  /** Agent-given name for an Other Document (a lead can have several). */
  customName?: string;
  pages: DocumentPage[];
  pdfFile?: PdfFile;
  pdfStatus: PdfStatus;
  status: string;
  uploadedAt: string;
}

export const MAX_DOCUMENT_PAGES = 10;
export const MAX_OTHER_DOCUMENTS = 5;

/** The name a document is shown under: its custom name for an Other Document, otherwise its type. */
export function documentLabel(doc: Pick<LeadDocument, 'documentType' | 'customName'>): string {
  return doc.customName?.trim() || doc.documentType;
}

/** Pages in their authoritative display order - pageNumber, never array order. */
export function sortedPages(doc: Pick<LeadDocument, 'pages'>): DocumentPage[] {
  return [...doc.pages].sort((a, b) => a.pageNumber - b.pageNumber);
}

export interface CustomerBasicDetails {
  fullName?: string;
  fatherHusbandName?: string;
  mobileNumber?: string;
  alternateMobileNumber?: string;
  email?: string;
  customerType?: CustomerType;
}

export interface CustomerAddress {
  fullAddress?: string;
  cityVillage?: string;
  district?: string;
  state?: string;
  pincode?: string;
}

export interface SolarInformation {
  requiredSystemSizeKw?: number;
}

export interface ElectricityDetails {
  consumerName?: string;
  consumerNumber?: string;
}

/** Piplav village registration defaults, pre-filled on every new registration. */
export const PIPLAV_DEFAULTS = {
  cityVillage: 'Piplav',
  district: 'Anand',
  state: 'Gujarat',
  pincode: '388460',
  customerType: 'Residential' as CustomerType,
  systemSizeKw: 2.18,
} as const;

export interface Lead {
  _id: string;
  leadId: string;
  customerBasicDetails: CustomerBasicDetails;
  customerAddress: CustomerAddress;
  solarInformation: SolarInformation;
  electricityDetails: ElectricityDetails;
  documents: LeadDocument[];
  notes?: string;
  createdBy: { _id: string; name: string; email: string } | string;
  status: LeadStatus;
  isDraft: boolean;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface AuditLogEntry {
  _id: string;
  action: string;
  actorName: string;
  actorRole: string;
  targetType?: string;
  targetId?: string;
  targetLabel?: string;
  details?: string;
  createdAt: string;
}
