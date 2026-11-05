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
  village: z.nativeEnum(QuotationVillage).default(QuotationVillage.PIPLAV),
  category: z.nativeEnum(QuotationCategory),
  extraIds: z.array(objectId).max(20).default([]),
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

export const listQuotationsQuerySchema = z.object({
  search: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
