import { NextFunction, Request, Response } from 'express';
import { ApiError } from '../utils/ApiError';
import { catchAsync } from '../utils/catchAsync';
import { verifyAccessToken, cookieNames } from '../services/token.service';
import { UserRole, UserStatus } from '../types/enums';
import { User } from '../models/User';

/**
 * Verifies the access token and attaches req.user. Also re-checks the
 * user's current status in the DB so a disabled agent is rejected even if
 * their access token has not yet expired.
 */
export const requireAuth = catchAsync(async (req: Request, _res: Response, next: NextFunction) => {
  const token = req.cookies?.[cookieNames.ACCESS_COOKIE];
  if (!token) {
    throw ApiError.unauthorized();
  }

  let payload;
  try {
    payload = verifyAccessToken(token);
  } catch {
    throw ApiError.unauthorized('Session expired, please log in again');
  }

  const user = await User.findById(payload.sub).select('_id name email role status').lean();
  if (!user || user.status !== UserStatus.ACTIVE) {
    throw ApiError.unauthorized('Account is not active');
  }

  req.user = {
    id: user._id.toString(),
    role: user.role as UserRole,
    name: user.name,
    email: user.email,
  };
  next();
});

export function requireRole(...roles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(ApiError.unauthorized());
    if (!roles.includes(req.user.role)) {
      return next(ApiError.forbidden());
    }
    next();
  };
}
