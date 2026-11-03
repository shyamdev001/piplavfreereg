import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { UserRole } from '../types/enums';
import {
  createAgentSchema,
  resetCredentialsSchema,
  updateAgentSchema,
  updateAgentStatusSchema,
} from '../validators/agent.validators';
import {
  createAgent,
  getAgent,
  getAgentLeadStats,
  listAgents,
  resetAgentCredentials,
  updateAgent,
  updateAgentStatus,
} from '../controllers/agent.controller';

const router = Router();

router.use(requireAuth, requireRole(UserRole.ADMIN));

router.get('/', listAgents);
router.post('/', validate({ body: createAgentSchema }), createAgent);
router.get('/:id', getAgent);
router.patch('/:id', validate({ body: updateAgentSchema }), updateAgent);
router.patch('/:id/status', validate({ body: updateAgentStatusSchema }), updateAgentStatus);
router.post('/:id/reset-credentials', validate({ body: resetCredentialsSchema }), resetAgentCredentials);
router.get('/:id/stats', getAgentLeadStats);

export default router;
