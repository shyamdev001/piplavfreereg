import { Request, Response } from 'express';
import { catchAsync } from '../utils/catchAsync';
import { Lead } from '../models/Lead';
import { User } from '../models/User';
import { CustomerType, UserRole } from '../types/enums';

export const getAdminDashboardStats = catchAsync(async (_req: Request, res: Response) => {
  const startOfToday = new Date(new Date().setHours(0, 0, 0, 0));

  const [totalLeads, todaysLeads, residential, commercial, totalAgents, statusBreakdown] = await Promise.all([
    Lead.countDocuments({ isDraft: false, archived: false }),
    Lead.countDocuments({ isDraft: false, archived: false, createdAt: { $gte: startOfToday } }),
    Lead.countDocuments({
      isDraft: false,
      archived: false,
      'customerBasicDetails.customerType': CustomerType.RESIDENTIAL,
    }),
    Lead.countDocuments({
      isDraft: false,
      archived: false,
      'customerBasicDetails.customerType': CustomerType.COMMERCIAL,
    }),
    User.countDocuments({ role: UserRole.AGENT }),
    Lead.aggregate([
      { $match: { isDraft: false, archived: false } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ]),
  ]);

  res.json({
    totalLeads,
    todaysLeads,
    residential,
    commercial,
    totalAgents,
    byStatus: Object.fromEntries(statusBreakdown.map((s) => [s._id, s.count])),
  });
});

export const getAgentDashboardStats = catchAsync(async (req: Request, res: Response) => {
  const startOfToday = new Date(new Date().setHours(0, 0, 0, 0));
  const createdBy = req.user!.id;

  const [total, today, drafts] = await Promise.all([
    Lead.countDocuments({ createdBy, isDraft: false, archived: false }),
    Lead.countDocuments({ createdBy, isDraft: false, archived: false, createdAt: { $gte: startOfToday } }),
    Lead.countDocuments({ createdBy, isDraft: true }),
  ]);

  const recentLeads = await Lead.find({ createdBy, isDraft: false, archived: false })
    .sort({ createdAt: -1 })
    .limit(5)
    .select('leadId customerBasicDetails.fullName status createdAt')
    .lean();

  res.json({ total, today, drafts, recentLeads });
});
