import { Request, Response } from 'express';
import { catchAsync } from '../utils/catchAsync';
import { AuditLog } from '../models/AuditLog';

export const listAuditLogs = catchAsync(async (req: Request, res: Response) => {
  const page = Math.max(1, Number(req.query.page ?? 1));
  const limit = Math.min(100, Math.max(1, Number(req.query.limit ?? 50)));
  const filter: Record<string, unknown> = {};

  if (req.query.targetId) filter.targetId = req.query.targetId;
  if (req.query.actorId) filter.actorId = req.query.actorId;
  if (req.query.action) filter.action = req.query.action;

  const [logs, total] = await Promise.all([
    AuditLog.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    AuditLog.countDocuments(filter),
  ]);

  res.json({ logs, pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) } });
});
