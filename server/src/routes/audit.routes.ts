import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.middleware';
import { UserRole } from '../types/enums';
import { listAuditLogs } from '../controllers/audit.controller';

const router = Router();

router.use(requireAuth, requireRole(UserRole.ADMIN));
router.get('/', listAuditLogs);

export default router;
