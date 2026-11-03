import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { UserRole } from '../types/enums';
import {
  checkDuplicateQuerySchema,
  draftLeadSchema,
  listLeadsQuerySchema,
  updateLeadStatusSchema,
} from '../validators/lead.validators';
import {
  archiveLead,
  checkDuplicateLead,
  createDraftLead,
  deleteDraftLead,
  exportLeads,
  getLead,
  listLeads,
  restoreLead,
  submitLead,
  updateLead,
  updateLeadStatus,
} from '../controllers/lead.controller';
import documentRoutes from './document.routes';

const router = Router();

router.use(requireAuth);

router.get('/', validate({ query: listLeadsQuerySchema }), listLeads);
router.get('/duplicates', validate({ query: checkDuplicateQuerySchema }), checkDuplicateLead);
router.get('/export', requireRole(UserRole.ADMIN), validate({ query: listLeadsQuerySchema }), exportLeads);

router.post('/', requireRole(UserRole.AGENT, UserRole.ADMIN), validate({ body: draftLeadSchema }), createDraftLead);
router.get('/:id', getLead);
router.patch('/:id', validate({ body: draftLeadSchema }), updateLead);
router.delete('/:id', deleteDraftLead);
router.post('/:id/submit', submitLead);

router.patch('/:id/status', requireRole(UserRole.ADMIN), validate({ body: updateLeadStatusSchema }), updateLeadStatus);
router.post('/:id/archive', requireRole(UserRole.ADMIN), archiveLead);
router.post('/:id/restore', requireRole(UserRole.ADMIN), restoreLead);

router.use('/:id/documents', documentRoutes);

export default router;
