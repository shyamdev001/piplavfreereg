import { Router } from 'express';
import authRoutes from './auth.routes';
import agentRoutes from './agent.routes';
import leadRoutes from './lead.routes';
import { standaloneDocumentsRouter } from './document.routes';
import dashboardRoutes from './dashboard.routes';
import auditRoutes from './audit.routes';
import { requireAuth } from '../middleware/auth.middleware';

const router = Router();

router.use('/auth', authRoutes);
router.use('/agents', agentRoutes);
router.use('/leads', leadRoutes);
router.use('/documents', requireAuth, standaloneDocumentsRouter);
router.use('/dashboard', dashboardRoutes);
router.use('/audit-logs', auditRoutes);

export default router;
