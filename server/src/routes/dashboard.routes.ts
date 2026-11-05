import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.middleware';
import { UserRole } from '../types/enums';
import { getAdminDashboardStats, getAgentDashboardStats } from '../controllers/dashboard.controller';

const router = Router();

router.use(requireAuth);

router.get('/stats', requireRole(UserRole.ADMIN, UserRole.VIEWER), getAdminDashboardStats);
router.get('/agent-stats', requireRole(UserRole.AGENT), getAgentDashboardStats);

export default router;
