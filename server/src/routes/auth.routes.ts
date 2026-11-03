import { Router } from 'express';
import { changePassword, getMe, login, logout, refresh } from '../controllers/auth.controller';
import { validate } from '../middleware/validate.middleware';
import { changePasswordSchema, loginSchema } from '../validators/auth.validators';
import { requireAuth } from '../middleware/auth.middleware';
import { authLimiter } from '../middleware/rateLimit.middleware';

const router = Router();

router.post('/login', authLimiter, validate({ body: loginSchema }), login);
router.post('/refresh', refresh);
router.post('/logout', requireAuth, logout);
router.get('/me', requireAuth, getMe);
router.post('/change-password', requireAuth, validate({ body: changePasswordSchema }), changePassword);

export default router;
