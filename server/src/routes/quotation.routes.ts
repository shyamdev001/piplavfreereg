import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { UserRole } from '../types/enums';
import {
  createQuotationSchema,
  listQuotationsQuerySchema,
  quotationExtraSchema,
  updateQuotationExtraSchema,
  idParamsSchema,
} from '../validators/quotation.validators';
import {
  createQuotation,
  createQuotationExtra,
  deleteQuotation,
  deleteQuotationExtra,
  listQuotationExtras,
  updateQuotationExtra,
  downloadQuotationPdf,
  listQuotations,
} from '../controllers/quotation.controller';

const router = Router();

router.use(requireAuth);

const anyQuotationRole = requireRole(UserRole.QUOTATION, UserRole.ADMIN, UserRole.VIEWER);

// Add-ons: everyone who sees quotations can list them; only admins change the list.
router.get('/extras', anyQuotationRole, listQuotationExtras);
router.post('/extras', requireRole(UserRole.ADMIN), validate({ body: quotationExtraSchema }), createQuotationExtra);
router.patch('/extras/:id', requireRole(UserRole.ADMIN), validate({ params: idParamsSchema, body: updateQuotationExtraSchema }), updateQuotationExtra);
router.delete('/extras/:id', requireRole(UserRole.ADMIN), validate({ params: idParamsSchema }), deleteQuotationExtra);

// Quotation users and admins make quotations; viewers can see and download them.
router.get('/', requireRole(UserRole.QUOTATION, UserRole.ADMIN, UserRole.VIEWER), validate({ query: listQuotationsQuerySchema }), listQuotations);
router.get('/:id/pdf', requireRole(UserRole.QUOTATION, UserRole.ADMIN, UserRole.VIEWER), downloadQuotationPdf);
router.post('/', requireRole(UserRole.QUOTATION, UserRole.ADMIN), validate({ body: createQuotationSchema }), createQuotation);
router.delete('/:id', requireRole(UserRole.ADMIN), deleteQuotation);

export default router;
