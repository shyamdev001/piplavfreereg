import { z } from 'zod';
import { UserRole, UserStatus } from '../types/enums';

export const createAgentSchema = z.object({
  name: z.string().trim().min(2, 'Name is required').max(120),
  email: z.string().trim().toLowerCase().email('Enter a valid email address'),
  phone: z.string().trim().regex(/^[0-9]{10}$/, 'Phone must be a 10-digit number'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain an uppercase letter')
    .regex(/[0-9]/, 'Password must contain a number'),
  role: z.enum([UserRole.AGENT, UserRole.VIEWER, UserRole.QUOTATION, UserRole.QUOTATION_STAFF]).default(UserRole.AGENT),
});

export const updateAgentSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  phone: z
    .string()
    .trim()
    .regex(/^[0-9]{10}$/, 'Phone must be a 10-digit number')
    .optional(),
});

export const updateAgentStatusSchema = z.object({
  status: z.enum([UserStatus.ACTIVE, UserStatus.DISABLED]),
});

export const resetCredentialsSchema = z.object({
  newPassword: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain an uppercase letter')
    .regex(/[0-9]/, 'Password must contain a number'),
});
