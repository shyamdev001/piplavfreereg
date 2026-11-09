import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { UserRole } from '../types/enums';
import {
  createQuotationSchema,
  listQuotationsQuerySchema,
  quotationExtraSchema,
  updateQuotationExtraSchema,
  updateQuotationSchema,
  quotationHistoryQuerySchema,
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
  updateQuotation,
  listQuotationHistory,
  exportQuotationHistory,
} from '../controllers/quotation.controller';

const router = Router();

router.use(requireAuth);

const anyQuotationRole = requireRole(UserRole.QUOTATION, UserRole.QUOTATION_STAFF, UserRole.ADMIN, UserRole.VIEWER);
const quotationMakers = requireRole(UserRole.QUOTATION, UserRole.QUOTATION_STAFF, UserRole.ADMIN);
const historyReaders = requireRole(UserRole.ADMIN, UserRole.VIEWER);

// Add-ons: everyone who sees quotations can list them; only admins change the list.
router.get('/extras', requireRole(UserRole.QUOTATION, UserRole.ADMIN, UserRole.VIEWER), listQuotationExtras);
router.post('/extras', requireRole(UserRole.ADMIN), validate({ body: quotationExtraSchema }), createQuotationExtra);
router.patch('/extras/:id', requireRole(UserRole.ADMIN), validate({ params: idParamsSchema, body: updateQuotationExtraSchema }), updateQuotationExtra);
router.delete('/extras/:id', requireRole(UserRole.ADMIN), validate({ params: idParamsSchema }), deleteQuotationExtra);

// Who did what and when: admins and viewers.
router.get('/history', historyReaders, validate({ query: quotationHistoryQuerySchema }), listQuotationHistory);
router.get('/history/export', historyReaders, validate({ query: quotationHistoryQuerySchema }), exportQuotationHistory);

// Quotation users, staff and admins make and edit quotations; viewers can see and download them.
router.get('/', anyQuotationRole, validate({ query: listQuotationsQuerySchema }), listQuotations);
router.get('/:id/pdf', anyQuotationRole, validate({ params: idParamsSchema }), downloadQuotationPdf);
router.post('/', quotationMakers, validate({ body: createQuotationSchema }), createQuotation);
router.patch('/:id', quotationMakers, validate({ params: idParamsSchema, body: updateQuotationSchema }), updateQuotation);
router.delete('/:id', requireRole(UserRole.ADMIN), validate({ params: idParamsSchema }), deleteQuotation);

export default router;
