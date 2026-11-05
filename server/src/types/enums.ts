export const UserRole = {
  ADMIN: 'ADMIN',
  AGENT: 'AGENT',
  /** Read-only: sees every registration and can view/download documents, but changes nothing. */
  VIEWER: 'VIEWER',
  /** Makes customer quotations only; has no access to registrations. */
  QUOTATION: 'QUOTATION',
} as const;
export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export const UserStatus = {
  ACTIVE: 'ACTIVE',
  DISABLED: 'DISABLED',
} as const;
export type UserStatus = (typeof UserStatus)[keyof typeof UserStatus];

export const CustomerType = {
  RESIDENTIAL: 'Residential',
  COMMERCIAL: 'Commercial',
} as const;
export type CustomerType = (typeof CustomerType)[keyof typeof CustomerType];

export const LeadStatus = {
  NEW: 'NEW',
  CONTACTED: 'CONTACTED',
  QUALIFIED: 'QUALIFIED',
  QUOTATION: 'QUOTATION',
  FOLLOW_UP: 'FOLLOW-UP',
  CONVERTED: 'CONVERTED',
  LOST: 'LOST',
  ARCHIVED: 'ARCHIVED',
} as const;
export type LeadStatus = (typeof LeadStatus)[keyof typeof LeadStatus];

export const DocumentType = {
  AADHAAR: 'Aadhaar Card',
  ELECTRICITY_BILL: 'Electricity Bill',
  BANK_PASSBOOK: 'Bank Passbook',
  PAN_CARD: 'PAN Card',
  OTHER: 'Other Document',
} as const;
export type DocumentType = (typeof DocumentType)[keyof typeof DocumentType];

export const DocumentStatus = {
  PENDING: 'PENDING',
  UPLOADED: 'UPLOADED',
  REPLACED: 'REPLACED',
} as const;
export type DocumentStatus = (typeof DocumentStatus)[keyof typeof DocumentStatus];

// Status of the generated PDF representation of a document (see PDF document
// system: images are converted to PDF, PDFs are stored as-is and marked READY
// immediately).
export const PdfStatus = {
  NOT_READY: 'NOT_READY',
  PROCESSING: 'PROCESSING',
  READY: 'READY',
  FAILED: 'FAILED',
} as const;
export type PdfStatus = (typeof PdfStatus)[keyof typeof PdfStatus];

export const AuditAction = {
  LOGIN: 'LOGIN',
  LOGIN_FAILED: 'LOGIN_FAILED',
  LOGOUT: 'LOGOUT',
  LEAD_CREATED: 'LEAD_CREATED',
  LEAD_UPDATED: 'LEAD_UPDATED',
  LEAD_STATUS_CHANGED: 'LEAD_STATUS_CHANGED',
  LEAD_ARCHIVED: 'LEAD_ARCHIVED',
  LEAD_RESTORED: 'LEAD_RESTORED',
  DOCUMENT_UPLOADED: 'DOCUMENT_UPLOADED',
  DOCUMENT_VIEWED: 'DOCUMENT_VIEWED',
  DOCUMENT_DOWNLOADED: 'DOCUMENT_DOWNLOADED',
  DOCUMENT_DELETED: 'DOCUMENT_DELETED',
  DOCUMENT_PDF_REGENERATED: 'DOCUMENT_PDF_REGENERATED',
  DOCUMENTS_BULK_DOWNLOADED: 'DOCUMENTS_BULK_DOWNLOADED',
  DOCUMENT_PAGE_REMOVED: 'DOCUMENT_PAGE_REMOVED',
  DOCUMENT_PAGES_REORDERED: 'DOCUMENT_PAGES_REORDERED',
  AGENT_CREATED: 'AGENT_CREATED',
  AGENT_UPDATED: 'AGENT_UPDATED',
  AGENT_DISABLED: 'AGENT_DISABLED',
  AGENT_ENABLED: 'AGENT_ENABLED',
  AGENT_CREDENTIALS_RESET: 'AGENT_CREDENTIALS_RESET',
  QUOTATION_CREATED: 'QUOTATION_CREATED',
  QUOTATION_DOWNLOADED: 'QUOTATION_DOWNLOADED',
  QUOTATION_DELETED: 'QUOTATION_DELETED',
} as const;
export type AuditAction = (typeof AuditAction)[keyof typeof AuditAction];
