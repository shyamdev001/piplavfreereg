import { z } from 'zod';
import { CustomerType, LeadStatus } from '../types/enums';

const mobileRegex = /^[0-9]{10}$/;
const pincodeRegex = /^[0-9]{6}$/;

// z.coerce.boolean() treats any non-empty string (including the literal "false")
// as truthy, so a query string like ?archived=false would incorrectly coerce to
// true. This preprocessor maps the actual "true"/"false" strings explicitly.
const booleanQueryParam = z.preprocess((val) => {
  if (typeof val === 'boolean') return val;
  if (val === 'true') return true;
  if (val === 'false') return false;
  return val;
}, z.boolean().optional());

// z.coerce.number() turns an empty string into 0 (Number("") === 0), which would
// silently save "left blank" as "explicitly zero" for optional numeric fields.
function optionalNumber(min: number, max: number) {
  return z.preprocess(
    (val) => (val === '' || val === undefined || val === null ? undefined : val),
    z.coerce.number().min(min).max(max).optional(),
  );
}

export const customerBasicDetailsSchema = z.object({
  fullName: z.string().trim().min(2, 'Customer name is required').max(120),
  fatherHusbandName: z.string().trim().max(120).optional().or(z.literal('')),
  mobileNumber: z.string().trim().regex(mobileRegex, 'Mobile number must be a valid 10-digit number'),
  alternateMobileNumber: z
    .string()
    .trim()
    .regex(mobileRegex, 'Alternate mobile number must be a valid 10-digit number')
    .optional()
    .or(z.literal('')),
  email: z.string().trim().toLowerCase().email('Invalid email address').optional().or(z.literal('')),
  customerType: z.enum([CustomerType.RESIDENTIAL, CustomerType.COMMERCIAL]),
});

export const customerAddressSchema = z.object({
  fullAddress: z.string().trim().min(5, 'Full address is required').max(500),
  cityVillage: z.string().trim().min(2, 'City/Village is required').max(120),
  district: z.string().trim().min(2, 'District is required').max(120),
  state: z.string().trim().min(2, 'State is required').max(120),
  pincode: z.string().trim().regex(pincodeRegex, 'PIN code must be a valid 6-digit code'),
});

export const solarInformationSchema = z.object({
  requiredSystemSizeKw: optionalNumber(0, 10000),
});

export const electricityDetailsSchema = z.object({
  consumerName: z.string().trim().max(120).optional().or(z.literal('')),
  consumerNumber: z.string().trim().max(60).optional().or(z.literal('')),
});

// Electricity consumer details are mandatory for a Piplav registration.
const requiredElectricityDetailsSchema = z.object({
  consumerName: z.string().trim().min(2, 'Electricity consumer name is required').max(120),
  consumerNumber: z.string().trim().min(1, 'Consumer number is required').max(60),
});

// Drafts may be partially filled while the agent is still working through the wizard.
export const draftLeadSchema = z.object({
  customerBasicDetails: customerBasicDetailsSchema.partial().optional(),
  customerAddress: customerAddressSchema.partial().optional(),
  solarInformation: solarInformationSchema.optional(),
  electricityDetails: electricityDetailsSchema.optional(),
  notes: z.string().trim().max(2000).optional().or(z.literal('')),
});

// Full validation enforced server-side before final submission.
export const submitLeadSchema = z.object({
  customerBasicDetails: customerBasicDetailsSchema,
  customerAddress: customerAddressSchema,
  solarInformation: solarInformationSchema.optional(),
  electricityDetails: requiredElectricityDetailsSchema,
  notes: z.string().trim().max(2000).optional().or(z.literal('')),
});

export const updateLeadStatusSchema = z.object({
  status: z.enum([
    LeadStatus.NEW,
    LeadStatus.CONTACTED,
    LeadStatus.QUALIFIED,
    LeadStatus.QUOTATION,
    LeadStatus.FOLLOW_UP,
    LeadStatus.CONVERTED,
    LeadStatus.LOST,
    LeadStatus.ARCHIVED,
  ]),
});

export const listLeadsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(200).optional(),
  agentId: z.string().trim().optional(),
  customerType: z.enum([CustomerType.RESIDENTIAL, CustomerType.COMMERCIAL]).optional(),
  status: z
    .enum([
      LeadStatus.NEW,
      LeadStatus.CONTACTED,
      LeadStatus.QUALIFIED,
      LeadStatus.QUOTATION,
      LeadStatus.FOLLOW_UP,
      LeadStatus.CONVERTED,
      LeadStatus.LOST,
      LeadStatus.ARCHIVED,
    ])
    .optional(),
  dateFrom: z.string().trim().optional(),
  dateTo: z.string().trim().optional(),
  archived: booleanQueryParam,
  isDraft: booleanQueryParam,
  sortBy: z.enum(['createdAt', 'updatedAt', 'leadId']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export const checkDuplicateQuerySchema = z.object({
  mobileNumber: z.string().trim().regex(mobileRegex, 'Mobile number must be a valid 10-digit number'),
});
