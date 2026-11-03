import { z } from 'zod';

const mobileRegex = /^[0-9]{10}$/;
const pincodeRegex = /^[0-9]{6}$/;

// HTML number inputs report an empty value as the string "", and z.coerce.number()
// would otherwise coerce that to 0 (Number("") === 0) - silently turning "left
// blank" into "explicitly zero". This preprocesses blank values to undefined first
// so optional numeric fields stay genuinely empty until the user types something.
function optionalNumber(min: number, max: number) {
  return z.preprocess(
    (val) => (val === '' || val === undefined || val === null ? undefined : val),
    z.coerce.number().min(min).max(max).optional(),
  );
}

export const basicDetailsSchema = z.object({
  fullName: z.string().trim().min(2, 'Customer name is required'),
  fatherHusbandName: z.string().trim().optional().or(z.literal('')),
  mobileNumber: z.string().trim().regex(mobileRegex, 'Enter a valid 10-digit mobile number'),
  alternateMobileNumber: z
    .string()
    .trim()
    .regex(mobileRegex, 'Enter a valid 10-digit mobile number')
    .optional()
    .or(z.literal('')),
  email: z.string().trim().email('Enter a valid email').optional().or(z.literal('')),
  customerType: z.enum(['Residential', 'Commercial'], { required_error: 'Select a customer type' }),
});
export type BasicDetailsForm = z.infer<typeof basicDetailsSchema>;

export const addressSchema = z.object({
  fullAddress: z.string().trim().min(5, 'Full address is required'),
  cityVillage: z.string().trim().min(2, 'City/Village is required'),
  district: z.string().trim().min(2, 'District is required'),
  state: z.string().trim().min(2, 'State is required'),
  pincode: z.string().trim().regex(pincodeRegex, 'Enter a valid 6-digit PIN code'),
});
export type AddressForm = z.infer<typeof addressSchema>;

export const solarInfoSchema = z.object({
  requiredSystemSizeKw: optionalNumber(0, 10000),
});
export type SolarInfoForm = z.infer<typeof solarInfoSchema>;

export const electricitySchema = z.object({
  consumerName: z.string().trim().min(2, 'Electricity consumer name is required').max(120),
  consumerNumber: z.string().trim().min(1, 'Consumer number is required').max(60),
});
export type ElectricityForm = z.infer<typeof electricitySchema>;

export const notesSchema = z.object({
  notes: z.string().trim().max(2000).optional().or(z.literal('')),
});
export type NotesForm = z.infer<typeof notesSchema>;

export const REQUIRED_DOCUMENT_TYPES = ['Aadhaar Card', 'Electricity Bill'] as const;
