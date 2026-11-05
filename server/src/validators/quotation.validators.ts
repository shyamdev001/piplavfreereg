import { z } from 'zod';
import { QuotationCategory } from '../config/quotation';

// The PDF uses a standard Latin font, so Gujarati/Hindi script can't be printed.
const ENGLISH_ONLY = /^[\x20-\x7E\r\n]*$/;
const englishText = (label: string, max: number) =>
  z
    .string()
    .trim()
    .min(2, `${label} is required`)
    .max(max)
    .regex(ENGLISH_ONLY, `${label}: please type in English letters`);

export const createQuotationSchema = z.object({
  customerName: englishText('Name', 120),
  address: englishText('Address', 300),
  mobileNumber: z.string().trim().regex(/^[0-9]{10}$/, 'Mobile must be a 10-digit number'),
  category: z.enum([QuotationCategory.GENERAL, QuotationCategory.SC_ST]),
});

export const listQuotationsQuerySchema = z.object({
  search: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
