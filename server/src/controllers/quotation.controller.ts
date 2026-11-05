import { Request, Response } from 'express';
import { FilterQuery } from 'mongoose';
import { catchAsync } from '../utils/catchAsync';
import { ApiError } from '../utils/ApiError';
import { Quotation, IQuotation } from '../models/Quotation';
import { getNextSequence } from '../models/Counter';
import { AuditAction, UserRole } from '../types/enums';
import { recordAudit } from '../services/audit.service';
import { buildQuotationPdf } from '../services/quotationPdf.service';
import { QUOTATION_PRICES, QUOTATION_SYSTEM, QUOTATION_VALIDITY_DAYS, QuotationCategory } from '../config/quotation';

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
  const { customerName, address, mobileNumber, category } = req.body as {
    customerName: string;
    address: string;
    mobileNumber: string;
    category: QuotationCategory;
  };
  const now = new Date();
  const quotation = await Quotation.create({
    quotationNumber: await nextQuotationNumber(now),
    customerName,
    address,
    mobileNumber,
    category,
    amount: QUOTATION_PRICES[category],
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
