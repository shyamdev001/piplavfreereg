import { z } from 'zod';
import { QuotationCategory, QuotationVillage } from '../config/quotation';

// The PDF uses a standard Latin font, so Gujarati/Hindi script can't be printed.
const ENGLISH_ONLY = /^[\x20-\x7E\r\n]*$/;
const englishText = (label: string, max: number) =>
  z
    .string()
    .trim()
    .min(2, `${label} is required`)
    .max(max)
    .regex(ENGLISH_ONLY, `${label}: please type in English letters`);

const objectId = z.string().regex(/^[0-9a-f]{24}$/i, 'Invalid id');

export const createQuotationSchema = z.object({
  customerName: englishText('Name', 120),
  address: englishText('Address', 300),
  mobileNumber: z.string().trim().regex(/^[0-9]{10}$/, 'Mobile must be a 10-digit number'),
  // Left out = Piplav (Mukt's form). Staff quotations are always Other village.
  village: z.nativeEnum(QuotationVillage).optional(),
  category: z.nativeEnum(QuotationCategory),
  // Staff quotations only: policy ticked (default) or not.
  policyIncluded: z.boolean().optional(),
  // Ticked add-ons with this customer's amount (e.g. the policy amount varies per customer).
  extras: z
    .array(z.object({ id: objectId, price: z.coerce.number().int('Amount must be in whole rupees').min(1, 'Enter the add-on amount') }))
    .max(20)
    .default([]),
});

export const quotationExtraSchema = z.object({
  name: englishText('Name', 80),
  description: z.string().trim().max(200).regex(ENGLISH_ONLY, 'Description: please type in English letters').optional(),
  price: z.coerce.number().int('Price must be in whole rupees').min(0).max(10000000),
  active: z.boolean().optional(),
});

export const updateQuotationExtraSchema = quotationExtraSchema.partial();

export const idParamsSchema = z.object({ id: objectId });
// Whether the category is offered in that village is checked in the controller (quotationPrice).

/** Fields that can be changed after a quotation is made; the number and date stay. */
export const updateQuotationSchema = z
  .object({
    customerName: englishText('Name', 120),
    address: englishText('Address', 300),
    mobileNumber: z.string().trim().regex(/^[0-9]{10}$/, 'Mobile must be a 10-digit number'),
    category: z.nativeEnum(QuotationCategory),
    policyIncluded: z.boolean(),
  })
  .partial();

const QUOTATION_HISTORY_ACTIONS = ['QUOTATION_CREATED', 'QUOTATION_UPDATED', 'QUOTATION_DOWNLOADED', 'QUOTATION_DELETED'] as const;

export const quotationHistoryQuerySchema = z.object({
  actorId: objectId.optional(),
  targetId: objectId.optional(),
  action: z.enum(QUOTATION_HISTORY_ACTIONS).optional(),
  search: z.string().trim().max(100).optional(),
  /** YYYY-MM-DD, India time, inclusive. */
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export const listQuotationsQuerySchema = z.object({
  search: z.string().trim().max(100).optional(),
  createdBy: objectId.optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
