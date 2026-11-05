import { Request, Response } from 'express';
import { FilterQuery } from 'mongoose';
import { catchAsync } from '../utils/catchAsync';
import { ApiError } from '../utils/ApiError';
import { Quotation, IQuotation } from '../models/Quotation';
import { QuotationExtra } from '../models/QuotationExtra';
import { getNextSequence } from '../models/Counter';
import { AuditAction, UserRole } from '../types/enums';
import { recordAudit } from '../services/audit.service';
import { buildQuotationPdf } from '../services/quotationPdf.service';
import { QUOTATION_SYSTEM, QUOTATION_VALIDITY_DAYS, QuotationCategory, QuotationVillage, quotationPrice } from '../config/quotation';

/** PROP-YYYYMMDD-NNNN, numbered per day (India time). */
async function nextQuotationNumber(now: Date): Promise<string> {
  const ist = new Date(now.getTime() + 330 * 60 * 1000);
  const day = `${ist.getUTCFullYear()}${String(ist.getUTCMonth() + 1).padStart(2, '0')}${String(ist.getUTCDate()).padStart(2, '0')}`;
  const seq = await getNextSequence(`quotation-${day}`);
  return `PROP-${day}-${String(seq).padStart(4, '0')}`;
}

function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Quotation users see the quotations they made; admins and viewers see all. */
function scopeFor(req: Request): FilterQuery<IQuotation> {
  return req.user!.role === UserRole.QUOTATION ? { createdBy: req.user!.id } : {};
}

async function findAccessible(req: Request) {
  const quotation = await Quotation.findOne({ _id: req.params.id, ...scopeFor(req) });
  if (!quotation) throw ApiError.notFound('Quotation not found');
  return quotation;
}

export const createQuotation = catchAsync(async (req: Request, res: Response) => {
  const { customerName, address, mobileNumber, village, category, extraIds } = req.body as {
    customerName: string;
    address: string;
    mobileNumber: string;
    village: QuotationVillage;
    category: QuotationCategory;
    extraIds: string[];
  };
  const basePrice = quotationPrice(village, category);
  if (basePrice === undefined) throw ApiError.badRequest('This category is not available for the selected village');

  // Prices come from the add-on list, never from the client.
  const uniqueIds = [...new Set(extraIds)];
  const found = uniqueIds.length ? await QuotationExtra.find({ _id: { $in: uniqueIds }, active: true }).lean() : [];
  if (found.length !== uniqueIds.length) throw ApiError.badRequest('One of the selected add-ons is no longer available');
  const byId = new Map(found.map((e) => [String(e._id), e]));
  const extras = uniqueIds.map((id) => {
    const e = byId.get(id)!;
    return { name: e.name, description: e.description, price: e.price };
  });
  const amount = basePrice + extras.reduce((sum, e) => sum + e.price, 0);
  const now = new Date();
  const quotation = await Quotation.create({
    quotationNumber: await nextQuotationNumber(now),
    customerName,
    address,
    mobileNumber,
    village,
    category,
    basePrice,
    extras,
    amount,
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
    targetLabel: `${quotation.quotationNumber} - ${quotation.customerName}`,
    req,
  });

  res.status(201).json({ quotation });
});

export const listQuotations = catchAsync(async (req: Request, res: Response) => {
  const { search, page, limit } = req.query as unknown as { search?: string; page: number; limit: number };
  const query: FilterQuery<IQuotation> = scopeFor(req);
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

export const downloadQuotationPdf = catchAsync(async (req: Request, res: Response) => {
  const quotation = await findAccessible(req);
  const pdf = await buildQuotationPdf(quotation);

  await recordAudit({
    action: AuditAction.QUOTATION_DOWNLOADED,
    actor: req.user!,
    targetType: 'Quotation',
    targetId: String(quotation._id),
    targetLabel: `${quotation.quotationNumber} - ${quotation.customerName}`,
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
    targetLabel: `${quotation.quotationNumber} - ${quotation.customerName}`,
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
