import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { UserRole } from '../types/enums';
import { createQuotationSchema, listQuotationsQuerySchema } from '../validators/quotation.validators';
import {
  createQuotation,
  deleteQuotation,
  downloadQuotationPdf,
  listQuotations,
} from '../controllers/quotation.controller';

const router = Router();

router.use(requireAuth);

// Quotation users and admins make quotations; viewers can see and download them.
router.get('/', requireRole(UserRole.QUOTATION, UserRole.ADMIN, UserRole.VIEWER), validate({ query: listQuotationsQuerySchema }), listQuotations);
router.get('/:id/pdf', requireRole(UserRole.QUOTATION, UserRole.ADMIN, UserRole.VIEWER), downloadQuotationPdf);
router.post('/', requireRole(UserRole.QUOTATION, UserRole.ADMIN), validate({ body: createQuotationSchema }), createQuotation);
router.delete('/:id', requireRole(UserRole.ADMIN), deleteQuotation);

export default router;
