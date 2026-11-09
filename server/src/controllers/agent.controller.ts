import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import { catchAsync } from '../utils/catchAsync';
import { ApiError } from '../utils/ApiError';
import { User } from '../models/User';
import { Lead } from '../models/Lead';
import { UserRole, UserStatus, AuditAction } from '../types/enums';
import { recordAudit } from '../services/audit.service';

/** Accounts an admin manages on the Team page: field agents, read-only viewers and quotation users. */
const MANAGED_ROLES = { $in: [UserRole.AGENT, UserRole.VIEWER, UserRole.QUOTATION, UserRole.QUOTATION_STAFF] };

export const listAgents = catchAsync(async (_req: Request, res: Response) => {
  const agents = await User.find({ role: MANAGED_ROLES }).sort({ createdAt: -1 }).lean();

  const leadCounts = await Lead.aggregate([
    { $match: { isDraft: false } },
    { $group: { _id: '$createdBy', total: { $sum: 1 } } },
  ]);
  const countMap = new Map(leadCounts.map((c) => [c._id.toString(), c.total]));

  res.json({
    agents: agents.map((a) => ({
      id: a._id,
      name: a.name,
      email: a.email,
      phone: a.phone,
      role: a.role,
      status: a.status,
      createdAt: a.createdAt,
      totalLeads: countMap.get(a._id.toString()) ?? 0,
    })),
  });
});

export const getAgent = catchAsync(async (req: Request, res: Response) => {
  const agent = await User.findOne({ _id: req.params.id, role: MANAGED_ROLES }).lean();
  if (!agent) throw ApiError.notFound('Agent not found');

  const totalLeads = await Lead.countDocuments({ createdBy: agent._id, isDraft: false });

  res.json({
    agent: {
      id: agent._id,
      name: agent.name,
      email: agent.email,
      phone: agent.phone,
      role: agent.role,
      status: agent.status,
      createdAt: agent.createdAt,
      totalLeads,
    },
  });
});

export const createAgent = catchAsync(async (req: Request, res: Response) => {
  const { name, email, phone, password, role } = req.body;

  const existing = await User.findOne({ email });
  if (existing) throw ApiError.conflict('An account with this email already exists');

  const passwordHash = await bcrypt.hash(password, 12);

  const agent = await User.create({
    name,
    email,
    phone,
    passwordHash,
    role,
    status: UserStatus.ACTIVE,
    mustChangePassword: false,
  });

  await recordAudit({
    action: AuditAction.AGENT_CREATED,
    actor: { id: req.user!.id, name: req.user!.name, role: req.user!.role },
    targetType: 'User',
    targetId: agent._id.toString(),
    targetLabel: agent.name,
    details:
      role === UserRole.VIEWER
        ? 'Viewer account'
        : role === UserRole.QUOTATION
          ? 'Quotation account'
          : role === UserRole.QUOTATION_STAFF
            ? 'Quotation staff account'
            : undefined,
    req,
  });

  res.status(201).json({
    agent: { id: agent._id, name: agent.name, email: agent.email, phone: agent.phone, role: agent.role, status: agent.status },
  });
});

export const updateAgent = catchAsync(async (req: Request, res: Response) => {
  const agent = await User.findOne({ _id: req.params.id, role: MANAGED_ROLES });
  if (!agent) throw ApiError.notFound('Agent not found');

  if (req.body.name !== undefined) agent.name = req.body.name;
  if (req.body.phone !== undefined) agent.phone = req.body.phone;
  await agent.save();

  await recordAudit({
    action: AuditAction.AGENT_UPDATED,
    actor: { id: req.user!.id, name: req.user!.name, role: req.user!.role },
    targetType: 'User',
    targetId: agent._id.toString(),
    targetLabel: agent.name,
    req,
  });

  res.json({ agent: { id: agent._id, name: agent.name, email: agent.email, phone: agent.phone, status: agent.status } });
});

export const updateAgentStatus = catchAsync(async (req: Request, res: Response) => {
  const agent = await User.findOne({ _id: req.params.id, role: MANAGED_ROLES }).select('+refreshTokenVersion');
  if (!agent) throw ApiError.notFound('Agent not found');

  agent.status = req.body.status;
  if (agent.status === UserStatus.DISABLED) {
    agent.refreshTokenVersion += 1; // force logout everywhere
  }
  await agent.save();

  await recordAudit({
    action: agent.status === UserStatus.DISABLED ? AuditAction.AGENT_DISABLED : AuditAction.AGENT_ENABLED,
    actor: { id: req.user!.id, name: req.user!.name, role: req.user!.role },
    targetType: 'User',
    targetId: agent._id.toString(),
    targetLabel: agent.name,
    req,
  });

  res.json({ agent: { id: agent._id, status: agent.status } });
});

export const resetAgentCredentials = catchAsync(async (req: Request, res: Response) => {
  const agent = await User.findOne({ _id: req.params.id, role: MANAGED_ROLES }).select('+refreshTokenVersion');
  if (!agent) throw ApiError.notFound('Agent not found');

  agent.passwordHash = await bcrypt.hash(req.body.newPassword, 12);
  agent.mustChangePassword = false;
  agent.refreshTokenVersion += 1;
  await agent.save();

  await recordAudit({
    action: AuditAction.AGENT_CREDENTIALS_RESET,
    actor: { id: req.user!.id, name: req.user!.name, role: req.user!.role },
    targetType: 'User',
    targetId: agent._id.toString(),
    targetLabel: agent.name,
    req,
  });

  res.json({ success: true });
});

export const getAgentLeadStats = catchAsync(async (req: Request, res: Response) => {
  const agent = await User.findOne({ _id: req.params.id, role: UserRole.AGENT }).lean();
  if (!agent) throw ApiError.notFound('Agent not found');

  const [total, today, statusBreakdown] = await Promise.all([
    Lead.countDocuments({ createdBy: agent._id, isDraft: false }),
    Lead.countDocuments({
      createdBy: agent._id,
      isDraft: false,
      createdAt: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) },
    }),
    Lead.aggregate([
      { $match: { createdBy: agent._id, isDraft: false } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
  ]);

  res.json({
    total,
    today,
    byStatus: Object.fromEntries(statusBreakdown.map((s) => [s._id, s.count])),
  });
});
