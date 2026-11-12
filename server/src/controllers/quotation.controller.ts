import { Request, Response } from 'express';
import { FilterQuery } from 'mongoose';
import { catchAsync } from '../utils/catchAsync';
import { ApiError } from '../utils/ApiError';
import { Quotation, IQuotation, IQuotationLineExtra } from '../models/Quotation';
import { QuotationExtra } from '../models/QuotationExtra';
import { AuditLog, IAuditLog } from '../models/AuditLog';
import { getNextSequence } from '../models/Counter';
import { AuditAction, UserRole } from '../types/enums';
import { recordAudit } from '../services/audit.service';
import { buildQuotationPdf } from '../services/quotationPdf.service';
import { formatIndianAmount } from '../utils/amountInWords';
import {
  QUOTATION_CATEGORY_LABELS,
  QUOTATION_SYSTEM,
  QUOTATION_VALIDITY_DAYS,
  STAFF_QUOTATION,
  QuotationCategory,
  QuotationVillage,
  quotationPrice,
  legacyPackagePrice,
} from '../config/quotation';

/**
 * PROP-YYYYMMDD-NNNN, numbered per day (India time). The counter is atomic and
 * quotationNumber has a unique index, so two people saving at the same moment
 * never get the same number.
 */
async function nextQuotationNumber(now: Date): Promise<string> {
  const ist = new Date(now.getTime() + 330 * 60 * 1000);
  const day = `${ist.getUTCFullYear()}${String(ist.getUTCMonth() + 1).padStart(2, '0')}${String(ist.getUTCDate()).padStart(2, '0')}`;
  const seq = await getNextSequence(`quotation-${day}`);
  return `PROP-${day}-${String(seq).padStart(4, '0')}`;
}

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const OWN_ONLY_ROLES: string[] = [UserRole.QUOTATION, UserRole.QUOTATION_STAFF];

/** Quotation users and staff see the quotations they made; admins and viewers see all. */
function scopeFor(req: Request): FilterQuery<IQuotation> {
  return OWN_ONLY_ROLES.includes(req.user!.role) ? { createdBy: req.user!.id } : {};
}

async function findAccessible(req: Request) {
  const quotation = await Quotation.findOne({ _id: req.params.id, ...scopeFor(req) });
  if (!quotation) throw ApiError.notFound('Quotation not found');
  return quotation;
}

const sum = (items: Array<{ price: number }>) => items.reduce((total, e) => total + e.price, 0);

/**
 * Staff quotations: Other village, policy ticked by default. Ticked, the policy is
 * added on top of the system price; unticked, it is left out.
 */
function staffPricing(category: QuotationCategory, policyIncluded: boolean) {
  if (!STAFF_QUOTATION.categories.includes(category)) throw ApiError.badRequest('Choose General or Pashupalak');
  const systemPrice = quotationPrice(STAFF_QUOTATION.village, category)!;
  const { policy } = STAFF_QUOTATION;
  return {
    pricingMode: 'ON_TOP' as const,
    basePrice: systemPrice,
    systemPrice,
    extras: policyIncluded ? [{ name: policy.name, price: policy.price, includedInPrice: false }] : [],
    amount: systemPrice + (policyIncluded ? policy.price : 0),
  };
}

/** Mukt's form: every add-on (policy, insurance, ...) is added on top of the system price. */
function standardPricing(village: QuotationVillage, category: QuotationCategory, extras: IQuotationLineExtra[]) {
  const systemPrice = quotationPrice(village, category);
  if (systemPrice === undefined) throw ApiError.badRequest('This category is not available for the selected village');
  return { pricingMode: 'ON_TOP' as const, basePrice: systemPrice, systemPrice, amount: systemPrice + sum(extras) };
}

/**
 * Quotations saved before add-ons were charged on top: the old package price was the
 * total and `includedInPrice` add-ons were carved out of it. Used when editing them,
 * so their total only moves if the category changes.
 */
function legacyStandardPricing(village: QuotationVillage, category: QuotationCategory, extras: IQuotationLineExtra[]) {
  const basePrice = legacyPackagePrice(village, category);
  if (basePrice === undefined) throw ApiError.badRequest('This category is not available for the selected village');
  const systemPrice = basePrice - sum(extras.filter((e) => e.includedInPrice));
  if (systemPrice <= 0) throw ApiError.badRequest('Add-ons cost more than the package price');
  return { basePrice, systemPrice, amount: basePrice + sum(extras.filter((e) => !e.includedInPrice)) };
}

const label = (q: Pick<IQuotation, 'quotationNumber' | 'customerName'>) => `${q.quotationNumber} - ${q.customerName}`;

export const createQuotation = catchAsync(async (req: Request, res: Response) => {
  const { customerName, address, mobileNumber, village, category, policyIncluded, extras: picked } = req.body as {
    customerName: string;
    address: string;
    mobileNumber: string;
    village?: QuotationVillage;
    category: QuotationCategory;
    policyIncluded?: boolean;
    extras: Array<{ id: string; price: number }>;
  };

  let fields: Partial<IQuotation>;
  if (req.user!.role === UserRole.QUOTATION_STAFF) {
    // Staff: Other village only, no add-on list - just the policy tick.
    if (village && village !== STAFF_QUOTATION.village) throw ApiError.forbidden('Staff can only make Other village quotations');
    if (picked.length) throw ApiError.badRequest('Add-ons are not available on staff quotations');
    const included = policyIncluded ?? true;
    fields = { village: STAFF_QUOTATION.village, kind: 'STAFF', policyIncluded: included, ...staffPricing(category, included) };
  } else {
    // Name and description come from the add-on list; the amount is typed per quotation.
    const uniqueIds = [...new Set(picked.map((p) => p.id))];
    if (uniqueIds.length !== picked.length) throw ApiError.badRequest('An add-on was selected twice');
    const found = uniqueIds.length ? await QuotationExtra.find({ _id: { $in: uniqueIds }, active: true }).lean() : [];
    if (found.length !== uniqueIds.length) throw ApiError.badRequest('One of the selected add-ons is no longer available');
    const byId = new Map(found.map((e) => [String(e._id), e]));
    const extras = picked.map((p) => {
      const e = byId.get(p.id)!;
      return { name: e.name, description: e.description, price: p.price, includedInPrice: false };
    });
    const v = village ?? QuotationVillage.PIPLAV;
    fields = { village: v, kind: 'STANDARD', extras, ...standardPricing(v, category, extras) };
  }

  const now = new Date();
  const quotation = await Quotation.create({
    ...fields,
    quotationNumber: await nextQuotationNumber(now),
    customerName,
    address,
    mobileNumber,
    category,
    systemSizeKw: QUOTATION_SYSTEM.sizeKw,
    quotationDate: now,
    expiryDate: new Date(now.getTime() + QUOTATION_VALIDITY_DAYS * 24 * 60 * 60 * 1000),
    createdBy: req.user!.id,
    createdByName: req.user!.name,
  });

  await recordAudit({
    action: AuditAction.QUOTATION_CREATED,
    actor: req.user!,
    targetType: 'Quotation',
    targetId: String(quotation._id),
    targetLabel: label(quotation),
    details: `${QUOTATION_CATEGORY_LABELS[quotation.category]} · Rs ${formatIndianAmount(quotation.amount)}${
      quotation.policyIncluded === false ? ' · policy not included' : ''
    }`,
    req,
  });

  res.status(201).json({ quotation });
});

/** Human-readable values used to describe an edit in the history. */
function describe(q: IQuotation): Record<string, string> {
  return {
    Name: q.customerName,
    Address: q.address,
    Mobile: q.mobileNumber,
    Category: QUOTATION_CATEGORY_LABELS[q.category],
    ...(q.kind === 'STAFF' ? { Policy: q.policyIncluded === false ? 'Not included' : 'Included' } : {}),
    Total: `Rs ${formatIndianAmount(q.amount)}`,
  };
}

export const updateQuotation = catchAsync(async (req: Request, res: Response) => {
  const quotation = await findAccessible(req);
  const body = req.body as Partial<{
    customerName: string;
    address: string;
    mobileNumber: string;
    category: QuotationCategory;
    policyIncluded: boolean;
  }>;
  if (body.policyIncluded !== undefined && quotation.kind !== 'STAFF') {
    throw ApiError.badRequest('Only staff quotations have the policy tick');
  }

  const before = describe(quotation);
  if (body.customerName !== undefined) quotation.customerName = body.customerName;
  if (body.address !== undefined) quotation.address = body.address;
  if (body.mobileNumber !== undefined) quotation.mobileNumber = body.mobileNumber;

  // Price is always recalculated on the server from the (possibly new) choices.
  const category = body.category ?? quotation.category;
  if (quotation.kind === 'STAFF') {
    const included = body.policyIncluded ?? quotation.policyIncluded ?? true;
    const p = staffPricing(category, included);
    quotation.set({ ...p, policyIncluded: included });
  } else {
    const pricing = quotation.pricingMode === 'ON_TOP' ? standardPricing : legacyStandardPricing;
    quotation.set(pricing(quotation.village, category, quotation.extras));
  }
  quotation.category = category;

  const after = describe(quotation);
  const changes = Object.keys(after)
    .filter((key) => before[key] !== after[key])
    .map((key) => `${key}: ${before[key]} -> ${after[key]}`);
  if (!changes.length) {
    res.json({ quotation });
    return;
  }

  quotation.updatedByName = req.user!.name;
  await quotation.save();
  await recordAudit({
    action: AuditAction.QUOTATION_UPDATED,
    actor: req.user!,
    targetType: 'Quotation',
    targetId: String(quotation._id),
    targetLabel: label(quotation),
    details: changes.join('; ').slice(0, 500),
    req,
  });
  res.json({ quotation });
});

export const listQuotations = catchAsync(async (req: Request, res: Response) => {
  const { search, createdBy, page, limit } = req.query as unknown as {
    search?: string;
    createdBy?: string;
    page: number;
    limit: number;
  };
  const query: FilterQuery<IQuotation> = scopeFor(req);
  // Admins and viewers can narrow the list to one person's quotations.
  if (createdBy && !OWN_ONLY_ROLES.includes(req.user!.role)) query.createdBy = createdBy;
  if (search) {
    const rx = new RegExp(escapeRegex(search), 'i');
    query.$or = [{ customerName: rx }, { mobileNumber: rx }, { quotationNumber: rx }];
  }
  const [quotations, total] = await Promise.all([
    Quotation.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    Quotation.countDocuments(query),
  ]);
  res.json({ quotations, pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) } });
});

// ---- History: who created, edited, downloaded or deleted which quotation, and when ----

const HISTORY_ACTIONS = [
  AuditAction.QUOTATION_CREATED,
  AuditAction.QUOTATION_UPDATED,
  AuditAction.QUOTATION_DOWNLOADED,
  AuditAction.QUOTATION_DELETED,
];

interface HistoryQuery {
  actorId?: string;
  targetId?: string;
  action?: string;
  search?: string;
  from?: string;
  to?: string;
  page: number;
  limit: number;
}

function historyFilter(q: HistoryQuery): FilterQuery<IAuditLog> {
  const filter: FilterQuery<IAuditLog> = { targetType: 'Quotation', action: q.action ?? { $in: HISTORY_ACTIONS } };
  if (q.actorId) filter.actorId = q.actorId;
  if (q.targetId) filter.targetId = q.targetId;
  if (q.search) filter.targetLabel = new RegExp(escapeRegex(q.search), 'i');
  // Dates are whole days in India time.
  if (q.from || q.to) {
    filter.createdAt = {
      ...(q.from ? { $gte: new Date(`${q.from}T00:00:00.000+05:30`) } : {}),
      ...(q.to ? { $lte: new Date(`${q.to}T23:59:59.999+05:30`) } : {}),
    };
  }
  return filter;
}

const HISTORY_FIELDS = 'action actorId actorName actorRole targetId targetLabel details createdAt';

export const listQuotationHistory = catchAsync(async (req: Request, res: Response) => {
  const q = req.query as unknown as HistoryQuery;
  const filter = historyFilter(q);
  const [logs, total] = await Promise.all([
    AuditLog.find(filter)
      .select(HISTORY_FIELDS)
      .sort({ createdAt: -1 })
      .skip((q.page - 1) * q.limit)
      .limit(q.limit)
      .lean(),
    AuditLog.countDocuments(filter),
  ]);
  res.json({ logs, pagination: { page: q.page, limit: q.limit, total, totalPages: Math.max(1, Math.ceil(total / q.limit)) } });
});

const ACTION_WORDS: Record<string, string> = {
  QUOTATION_CREATED: 'Created',
  QUOTATION_UPDATED: 'Edited',
  QUOTATION_DOWNLOADED: 'Downloaded / viewed PDF',
  QUOTATION_DELETED: 'Deleted',
};

const ROLE_WORDS: Record<string, string> = {
  ADMIN: 'Admin',
  QUOTATION: 'Quotation',
  QUOTATION_STAFF: 'Staff',
  VIEWER: 'Viewer',
};

/** CSV cell: quoted, and never starting with a spreadsheet formula character. */
function csvCell(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return `"${safe.replace(/"/g, '""')}"`;
}

function istDateTime(d: Date): string {
  const ist = new Date(d.getTime() + 330 * 60 * 1000);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(ist.getUTCDate())}-${p(ist.getUTCMonth() + 1)}-${ist.getUTCFullYear()} ${p(ist.getUTCHours())}:${p(ist.getUTCMinutes())}`;
}

/** Same filters as the list, as a CSV that opens in Excel (newest first, up to 5000 rows). */
export const exportQuotationHistory = catchAsync(async (req: Request, res: Response) => {
  const logs = await AuditLog.find(historyFilter(req.query as unknown as HistoryQuery))
    .select(HISTORY_FIELDS)
    .sort({ createdAt: -1 })
    .limit(5000)
    .lean();
  const rows = [
    ['Date & time (IST)', 'User', 'Role', 'Action', 'Quotation', 'Details'],
    ...logs.map((l) => [
      istDateTime(l.createdAt),
      l.actorName,
      ROLE_WORDS[l.actorRole] ?? l.actorRole,
      ACTION_WORDS[l.action] ?? l.action,
      l.targetLabel ?? '',
      l.details ?? '',
    ]),
  ];
  const csv = '\uFEFF' + rows.map((r) => r.map(csvCell).join(',')).join('\r\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="quotation-history.csv"`);
  res.setHeader('Cache-Control', 'no-store');
  res.send(csv);
});

export const downloadQuotationPdf = catchAsync(async (req: Request, res: Response) => {
  const quotation = await findAccessible(req);
  const pdf = await buildQuotationPdf(quotation);

  await recordAudit({
    action: AuditAction.QUOTATION_DOWNLOADED,
    actor: req.user!,
    targetType: 'Quotation',
    targetId: String(quotation._id),
    targetLabel: label(quotation),
    req,
  });

  const safeName = quotation.customerName.replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'customer';
  const disposition = req.query.inline === '1' ? 'inline' : 'attachment';
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `${disposition}; filename="Quotation-${quotation.quotationNumber}-${safeName}.pdf"`);
  res.setHeader('Cache-Control', 'no-store');
  res.send(pdf);
});

export const deleteQuotation = catchAsync(async (req: Request, res: Response) => {
  const quotation = await findAccessible(req);
  await quotation.deleteOne();
  await recordAudit({
    action: AuditAction.QUOTATION_DELETED,
    actor: req.user!,
    targetType: 'Quotation',
    targetId: String(quotation._id),
    targetLabel: label(quotation),
    req,
  });
  res.json({ message: 'Quotation deleted' });
});

// ---- Add-ons (Insurance, WiFi dongle, ...) ----

/** Admins see every add-on; everyone else only the ones on offer. */
export const listQuotationExtras = catchAsync(async (req: Request, res: Response) => {
  const filter = req.user!.role === UserRole.ADMIN ? {} : { active: true };
  const extras = await QuotationExtra.find(filter).sort({ active: -1, name: 1 }).lean();
  res.json({ extras });
});

export const createQuotationExtra = catchAsync(async (req: Request, res: Response) => {
  const extra = await QuotationExtra.create(req.body);
  res.status(201).json({ extra });
});

export const updateQuotationExtra = catchAsync(async (req: Request, res: Response) => {
  const extra = await QuotationExtra.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
  if (!extra) throw ApiError.notFound('Add-on not found');
  res.json({ extra });
});

/** Old quotations keep their own copy, so deleting an add-on never changes them. */
export const deleteQuotationExtra = catchAsync(async (req: Request, res: Response) => {
  const extra = await QuotationExtra.findByIdAndDelete(req.params.id);
  if (!extra) throw ApiError.notFound('Add-on not found');
  res.json({ message: 'Add-on deleted' });
});
