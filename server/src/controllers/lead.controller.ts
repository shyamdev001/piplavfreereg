import { Request, Response } from 'express';
import { Types } from 'mongoose';
import { catchAsync } from '../utils/catchAsync';
import { ApiError } from '../utils/ApiError';
import { Lead } from '../models/Lead';
import { generateLeadId } from '../utils/generateLeadId';
import { buildLeadFilterQuery, canAccessLead, findDuplicateLeadsByMobile } from '../services/lead.service';
import { deleteDocumentGroupAssets } from '../services/cloudinary.service';
import { recordAudit } from '../services/audit.service';
import { AuditAction, LeadStatus, UserRole } from '../types/enums';
import { submitLeadSchema } from '../validators/lead.validators';

async function loadLeadOrThrow(id: string) {
  if (!Types.ObjectId.isValid(id)) throw ApiError.notFound('Lead not found');
  const lead = await Lead.findById(id);
  if (!lead) throw ApiError.notFound('Lead not found');
  return lead;
}

export const createDraftLead = catchAsync(async (req: Request, res: Response) => {
  const leadId = await generateLeadId();
  const lead = await Lead.create({
    leadId,
    createdBy: req.user!.id,
    status: LeadStatus.NEW,
    isDraft: true,
    ...req.body,
  });

  res.status(201).json({ lead });
});

export const updateLead = catchAsync(async (req: Request, res: Response) => {
  const lead = await loadLeadOrThrow(req.params.id);

  if (!canAccessLead(lead, req.user!)) throw ApiError.forbidden("You don't have permission to access this lead.");
  if (!lead.isDraft && req.user!.role !== UserRole.ADMIN) {
    throw ApiError.forbidden('This lead has already been submitted and can no longer be edited by field agents.');
  }

  const allowedSections = ['customerBasicDetails', 'customerAddress', 'solarInformation', 'electricityDetails', 'notes'];
  for (const section of allowedSections) {
    if (req.body[section] !== undefined) {
      if (section === 'notes') {
        lead.notes = req.body.notes;
      } else {
        Object.assign((lead as any)[section], req.body[section]);
      }
    }
  }

  await lead.save();

  await recordAudit({
    action: AuditAction.LEAD_UPDATED,
    actor: { id: req.user!.id, name: req.user!.name, role: req.user!.role },
    targetType: 'Lead',
    targetId: lead._id.toString(),
    targetLabel: lead.leadId,
    req,
  });

  res.json({ lead });
});

export const submitLead = catchAsync(async (req: Request, res: Response) => {
  const lead = await loadLeadOrThrow(req.params.id);
  if (!canAccessLead(lead, req.user!)) throw ApiError.forbidden("You don't have permission to access this lead.");

  // Re-validate the complete record server-side before allowing submission.
  const parsed = submitLeadSchema.safeParse({
    customerBasicDetails: lead.customerBasicDetails,
    customerAddress: lead.customerAddress,
    solarInformation: lead.solarInformation,
    electricityDetails: lead.electricityDetails,
    notes: lead.notes,
  });
  if (!parsed.success) {
    throw ApiError.badRequest(
      'Some required information is missing or invalid.',
      parsed.error.errors.map((e) => ({ path: e.path.join('.'), message: e.message })),
    );
  }

  lead.isDraft = false;
  await lead.save();

  await recordAudit({
    action: AuditAction.LEAD_CREATED,
    actor: { id: req.user!.id, name: req.user!.name, role: req.user!.role },
    targetType: 'Lead',
    targetId: lead._id.toString(),
    targetLabel: lead.leadId,
    req,
  });

  res.json({ lead });
});

export const getLead = catchAsync(async (req: Request, res: Response) => {
  const lead = await loadLeadOrThrow(req.params.id);
  if (!canAccessLead(lead, req.user!)) throw ApiError.forbidden("You don't have permission to access this lead.");

  const populated = await lead.populate('createdBy', 'name email');
  res.json({ lead: populated });
});

export const listLeads = catchAsync(async (req: Request, res: Response) => {
  const filters = req.query as unknown as {
    page: number;
    limit: number;
    search?: string;
    agentId?: string;
    customerType?: string;
    status?: string;
    dateFrom?: string;
    dateTo?: string;
    archived?: boolean;
    isDraft?: boolean;
    sortBy: string;
    sortOrder: 'asc' | 'desc';
  };

  const query = buildLeadFilterQuery(filters, req.user!);
  const skip = (filters.page - 1) * filters.limit;

  const [leads, total] = await Promise.all([
    Lead.find(query)
      .populate('createdBy', 'name email')
      .sort({ [filters.sortBy]: filters.sortOrder === 'asc' ? 1 : -1 })
      .skip(skip)
      .limit(filters.limit)
      .lean(),
    Lead.countDocuments(query),
  ]);

  res.json({
    leads,
    pagination: {
      page: filters.page,
      limit: filters.limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / filters.limit)),
    },
  });
});

export const updateLeadStatus = catchAsync(async (req: Request, res: Response) => {
  const lead = await loadLeadOrThrow(req.params.id);
  const previousStatus = lead.status;
  lead.status = req.body.status;
  await lead.save();

  await recordAudit({
    action: AuditAction.LEAD_STATUS_CHANGED,
    actor: { id: req.user!.id, name: req.user!.name, role: req.user!.role },
    targetType: 'Lead',
    targetId: lead._id.toString(),
    targetLabel: lead.leadId,
    details: `${previousStatus} -> ${lead.status}`,
    req,
  });

  await lead.populate('createdBy', 'name email');
  res.json({ lead });
});

export const archiveLead = catchAsync(async (req: Request, res: Response) => {
  const lead = await loadLeadOrThrow(req.params.id);
  lead.archived = true;
  await lead.save();

  await recordAudit({
    action: AuditAction.LEAD_ARCHIVED,
    actor: { id: req.user!.id, name: req.user!.name, role: req.user!.role },
    targetType: 'Lead',
    targetId: lead._id.toString(),
    targetLabel: lead.leadId,
    req,
  });

  await lead.populate('createdBy', 'name email');
  res.json({ lead });
});

export const restoreLead = catchAsync(async (req: Request, res: Response) => {
  const lead = await loadLeadOrThrow(req.params.id);
  lead.archived = false;
  await lead.save();

  await recordAudit({
    action: AuditAction.LEAD_RESTORED,
    actor: { id: req.user!.id, name: req.user!.name, role: req.user!.role },
    targetType: 'Lead',
    targetId: lead._id.toString(),
    targetLabel: lead.leadId,
    req,
  });

  await lead.populate('createdBy', 'name email');
  res.json({ lead });
});

export const deleteDraftLead = catchAsync(async (req: Request, res: Response) => {
  const lead = await loadLeadOrThrow(req.params.id);
  if (!canAccessLead(lead, req.user!)) throw ApiError.forbidden("You don't have permission to access this lead.");
  if (!lead.isDraft) throw ApiError.badRequest('Only draft leads can be deleted. Submitted leads must be archived.');

  await Promise.all(lead.documents.map((doc) => deleteDocumentGroupAssets(doc)));
  await lead.deleteOne();

  res.json({ success: true });
});

export const checkDuplicateLead = catchAsync(async (req: Request, res: Response) => {
  const { mobileNumber } = req.query as { mobileNumber: string };
  const matches = await findDuplicateLeadsByMobile(mobileNumber);
  res.json({ duplicates: matches, hasDuplicates: matches.length > 0 });
});

export const exportLeads = catchAsync(async (req: Request, res: Response) => {
  const filters = req.query as unknown as Parameters<typeof buildLeadFilterQuery>[0];
  const query = buildLeadFilterQuery(filters, req.user!);

  const leads = await Lead.find(query)
    .populate('createdBy', 'name')
    .sort({ createdAt: -1 })
    .limit(10000)
    .lean();

  const header = [
    'Registration ID',
    'Customer Name',
    'Mobile',
    'Customer Type',
    'Village',
    'System Size (kW)',
    'Electricity Consumer Name',
    'Consumer Number',
    'Agent',
    'Status',
    'Created Date',
  ];

  const escapeCsv = (value: unknown) => {
    const str = String(value ?? '');
    return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
  };

  const rows = leads.map((l) =>
    [
      l.leadId,
      l.customerBasicDetails?.fullName,
      l.customerBasicDetails?.mobileNumber,
      l.customerBasicDetails?.customerType,
      l.customerAddress?.cityVillage,
      l.solarInformation?.requiredSystemSizeKw,
      l.electricityDetails?.consumerName,
      l.electricityDetails?.consumerNumber,
      (l.createdBy as any)?.name,
      l.status,
      new Date(l.createdAt).toISOString().slice(0, 10),
    ]
      .map(escapeCsv)
      .join(','),
  );

  const csv = [header.join(','), ...rows].join('\n');

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="piplav-registrations-${Date.now()}.csv"`);
  res.send(csv);
});
