import { Schema, model, Document, Types } from 'mongoose';
import { CustomerType, DocumentStatus, DocumentType, LeadStatus, PdfStatus } from '../types/enums';

/** Piplav village registration defaults - every registration is a residential
 * rooftop in Piplav (Anand, Gujarat) on the standard 2.18 kW system. */
export const PIPLAV_DEFAULTS = {
  cityVillage: 'Piplav',
  district: 'Anand',
  state: 'Gujarat',
  pincode: '388460',
  customerType: CustomerType.RESIDENTIAL,
  systemSizeKw: 2.18,
} as const;

/**
 * One page of a document (a single photographed page, or a PDF uploaded
 * as-is). `pageNumber` is the explicit, authoritative order index - page
 * order must never be inferred from array position, filename, or upload
 * timestamp, since pages can be reordered after upload.
 */
export interface IDocumentPage {
  _id: Types.ObjectId;
  pageNumber: number;
  cloudinaryPublicId: string;
  resourceType: string;
  mimeType: string;
  originalName: string;
  fileSize: number;
  uploadedAt: Date;
}

/** The generated (or passed-through) PDF representation of a document. */
export interface IPdfFile {
  cloudinaryPublicId: string;
  resourceType: string;
  fileSize: number;
  generatedAt: Date;
}

export interface ILeadDocument {
  _id: Types.ObjectId;
  documentType: DocumentType;
  /** Agent-given name for an "Other Document" (e.g. "Ration Card"). A lead can
   * hold several Other Documents, told apart by this name. */
  customName?: string;
  /** One entry per page. Multiple images combine into one PDF, ordered by pageNumber. */
  pages: Types.DocumentArray<IDocumentPage>;
  /** The single usable PDF for this document - either generated from pages, or (when the
   * agent uploaded a PDF directly) the same asset as pages[0]. */
  pdfFile?: IPdfFile;
  pdfStatus: PdfStatus;
  status: DocumentStatus;
  uploadedBy: Types.ObjectId;
  uploadedAt: Date;
}

export interface ICustomerBasicDetails {
  fullName: string;
  fatherHusbandName?: string;
  mobileNumber: string;
  alternateMobileNumber?: string;
  email?: string;
  customerType: CustomerType;
}

export interface ICustomerAddress {
  fullAddress: string;
  cityVillage: string;
  district: string;
  state: string;
  pincode: string;
}

export interface ISolarInformation {
  requiredSystemSizeKw?: number;
}

export interface IElectricityDetails {
  consumerName?: string;
  consumerNumber?: string;
}

export interface ILead extends Document {
  _id: Types.ObjectId;
  leadId: string;
  customerBasicDetails: ICustomerBasicDetails;
  customerAddress: ICustomerAddress;
  solarInformation: ISolarInformation;
  electricityDetails: IElectricityDetails;
  documents: Types.DocumentArray<ILeadDocument>;
  notes?: string;
  createdBy: Types.ObjectId;
  status: LeadStatus;
  isDraft: boolean;
  archived: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const documentPageSchema = new Schema<IDocumentPage>(
  {
    pageNumber: { type: Number, required: true },
    cloudinaryPublicId: { type: String, required: true },
    resourceType: { type: String, required: true },
    mimeType: { type: String, required: true },
    originalName: { type: String, required: true },
    fileSize: { type: Number, required: true },
    uploadedAt: { type: Date, default: Date.now },
  },
  { _id: true },
);

const pdfFileSchema = new Schema<IPdfFile>(
  {
    cloudinaryPublicId: { type: String, required: true },
    resourceType: { type: String, required: true },
    fileSize: { type: Number, required: true },
    generatedAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const leadDocumentSchema = new Schema<ILeadDocument>(
  {
    documentType: { type: String, enum: Object.values(DocumentType), required: true },
    customName: { type: String, trim: true, maxlength: 80 },
    pages: { type: [documentPageSchema], default: [] },
    pdfFile: { type: pdfFileSchema, default: undefined },
    pdfStatus: { type: String, enum: Object.values(PdfStatus), default: PdfStatus.PROCESSING },
    status: { type: String, enum: Object.values(DocumentStatus), default: DocumentStatus.UPLOADED },
    uploadedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    uploadedAt: { type: Date, default: Date.now },
  },
  { _id: true },
);

const customerBasicDetailsSchema = new Schema<ICustomerBasicDetails>(
  {
    fullName: { type: String, trim: true, maxlength: 120 },
    fatherHusbandName: { type: String, trim: true, maxlength: 120 },
    mobileNumber: { type: String, trim: true, match: [/^[0-9]{10}$/, 'Mobile number must be 10 digits'] },
    alternateMobileNumber: {
      type: String,
      trim: true,
      match: [/^$|^[0-9]{10}$/, 'Alternate mobile number must be 10 digits'],
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      match: [/^$|^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Invalid email address'],
    },
    customerType: { type: String, enum: Object.values(CustomerType), default: PIPLAV_DEFAULTS.customerType },
  },
  { _id: false },
);

const customerAddressSchema = new Schema<ICustomerAddress>(
  {
    fullAddress: { type: String, trim: true, maxlength: 500 },
    cityVillage: { type: String, trim: true, maxlength: 120, default: PIPLAV_DEFAULTS.cityVillage },
    district: { type: String, trim: true, maxlength: 120, default: PIPLAV_DEFAULTS.district },
    state: { type: String, trim: true, maxlength: 120, default: PIPLAV_DEFAULTS.state },
    pincode: {
      type: String,
      trim: true,
      match: [/^$|^[0-9]{6}$/, 'PIN code must be 6 digits'],
      default: PIPLAV_DEFAULTS.pincode,
    },
  },
  { _id: false },
);

const solarInformationSchema = new Schema<ISolarInformation>(
  {
    requiredSystemSizeKw: { type: Number, min: 0, default: PIPLAV_DEFAULTS.systemSizeKw },
  },
  { _id: false },
);

const electricityDetailsSchema = new Schema<IElectricityDetails>(
  {
    consumerName: { type: String, trim: true, maxlength: 120 },
    consumerNumber: { type: String, trim: true, maxlength: 60 },
  },
  { _id: false },
);

const leadSchema = new Schema<ILead>(
  {
    leadId: { type: String, required: true, unique: true },
    customerBasicDetails: { type: customerBasicDetailsSchema, default: () => ({}) },
    customerAddress: { type: customerAddressSchema, default: () => ({}) },
    solarInformation: { type: solarInformationSchema, default: () => ({}) },
    electricityDetails: { type: electricityDetailsSchema, default: () => ({}) },
    documents: { type: [leadDocumentSchema], default: [] },
    notes: { type: String, trim: true, maxlength: 2000 },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    status: { type: String, enum: Object.values(LeadStatus), default: LeadStatus.NEW },
    isDraft: { type: Boolean, default: true },
    archived: { type: Boolean, default: false },
  },
  { timestamps: true },
);

leadSchema.index({ 'customerBasicDetails.mobileNumber': 1 });
leadSchema.index({ 'customerBasicDetails.fullName': 'text' });
leadSchema.index({ 'electricityDetails.consumerNumber': 1 });
leadSchema.index({ createdBy: 1 });
leadSchema.index({ status: 1 });
leadSchema.index({ createdAt: -1 });
leadSchema.index({ archived: 1 });
leadSchema.index({ isDraft: 1 });

export const Lead = model<ILead>('Lead', leadSchema);
