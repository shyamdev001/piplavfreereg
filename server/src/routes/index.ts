import { Router } from 'express';
import authRoutes from './auth.routes';
import agentRoutes from './agent.routes';
import leadRoutes from './lead.routes';
import { standaloneDocumentsRouter } from './document.routes';
import dashboardRoutes from './dashboard.routes';
import auditRoutes from './audit.routes';
import quotationRoutes from './quotation.routes';
import { requireAuth, requireRole } from '../middleware/auth.middleware';
import { UserRole } from '../types/enums';

const router = Router();

router.use('/auth', authRoutes);
router.use('/agents', agentRoutes);
router.use('/leads', leadRoutes);
// Registration documents: everyone except quotation-only users.
router.use(
  '/documents',
  requireAuth,
  requireRole(UserRole.AGENT, UserRole.ADMIN, UserRole.VIEWER),
  standaloneDocumentsRouter,
);
router.use('/dashboard', dashboardRoutes);
router.use('/audit-logs', auditRoutes);
router.use('/quotations', quotationRoutes);

export default router;
