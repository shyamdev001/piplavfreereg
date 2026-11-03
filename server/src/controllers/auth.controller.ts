import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { catchAsync } from '../utils/catchAsync';
import { ApiError } from '../utils/ApiError';
import { User } from '../models/User';
import { UserStatus } from '../types/enums';
import {
  clearAuthCookies,
  setAuthCookies,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  cookieNames,
} from '../services/token.service';
import { recordAudit } from '../services/audit.service';
import { AuditAction } from '../types/enums';

export const login = catchAsync(async (req: Request, res: Response) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email }).select('+passwordHash +refreshTokenVersion');
  if (!user) {
    throw ApiError.unauthorized('Invalid email or password');
  }

  const passwordMatches = await bcrypt.compare(password, user.passwordHash);
  if (!passwordMatches) {
    await recordAudit({
      action: AuditAction.LOGIN_FAILED,
      actor: { id: user._id.toString(), name: user.name, role: user.role },
      details: 'Incorrect password',
      req,
    });
    throw ApiError.unauthorized('Invalid email or password');
  }

  if (user.status !== UserStatus.ACTIVE) {
    throw ApiError.forbidden('Your account has been disabled. Contact your administrator.');
  }

  const accessToken = signAccessToken({
    sub: user._id.toString(),
    role: user.role,
    name: user.name,
    email: user.email,
  });
  const refreshToken = signRefreshToken({ sub: user._id.toString(), tokenVersion: user.refreshTokenVersion });

  setAuthCookies(res, accessToken, refreshToken);

  await recordAudit({
    action: AuditAction.LOGIN,
    actor: { id: user._id.toString(), name: user.name, role: user.role },
    req,
  });

  res.json({
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      mustChangePassword: user.mustChangePassword,
    },
  });
});

export const refresh = catchAsync(async (req: Request, res: Response) => {
  const token = req.cookies?.[cookieNames.REFRESH_COOKIE];
  if (!token) throw ApiError.unauthorized('Please log in again');

  let payload;
  try {
    payload = verifyRefreshToken(token);
  } catch {
    throw ApiError.unauthorized('Session expired, please log in again');
  }

  const user = await User.findById(payload.sub).select('+refreshTokenVersion');
  if (!user || user.status !== UserStatus.ACTIVE || user.refreshTokenVersion !== payload.tokenVersion) {
    throw ApiError.unauthorized('Session expired, please log in again');
  }

  const accessToken = signAccessToken({
    sub: user._id.toString(),
    role: user.role,
    name: user.name,
    email: user.email,
  });
  const refreshToken = signRefreshToken({ sub: user._id.toString(), tokenVersion: user.refreshTokenVersion });
  setAuthCookies(res, accessToken, refreshToken);

  res.json({ success: true });
});

export const logout = catchAsync(async (req: Request, res: Response) => {
  if (req.user) {
    await recordAudit({
      action: AuditAction.LOGOUT,
      actor: { id: req.user.id, name: req.user.name, role: req.user.role },
      req,
    });
  }
  clearAuthCookies(res);
  res.json({ success: true });
});

export const getMe = catchAsync(async (req: Request, res: Response) => {
  const user = await User.findById(req.user!.id).select('name email role phone mustChangePassword');
  if (!user) throw ApiError.notFound('User not found');
  res.json({ user });
});

export const changePassword = catchAsync(async (req: Request, res: Response) => {
  const { currentPassword, newPassword } = req.body;
  const user = await User.findById(req.user!.id).select('+passwordHash +refreshTokenVersion');
  if (!user) throw ApiError.notFound('User not found');

  const matches = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!matches) throw ApiError.badRequest('Current password is incorrect');

  user.passwordHash = await bcrypt.hash(newPassword, 12);
  user.mustChangePassword = false;
  user.refreshTokenVersion += 1; // invalidate existing refresh tokens/sessions
  await user.save();

  clearAuthCookies(res);
  res.json({ success: true, message: 'Password updated. Please log in again.' });
});
