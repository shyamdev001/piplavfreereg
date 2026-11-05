import { Request, Response } from 'express';
import { Types } from 'mongoose';
import archiver from 'archiver';
import { catchAsync } from '../utils/catchAsync';
import { ApiError } from '../utils/ApiError';
import { Lead, ILead, ILeadDocument, IDocumentPage } from '../models/Lead';
import { canAccessLead } from '../services/lead.service';
import { optimizeImageBuffer } from '../services/image.service';
import { imagesToPdf } from '../services/pdf.service';
import {
  buildSignedDownloadUrl,
  buildSignedViewUrl,
  deleteDocumentAsset,
  deleteDocumentGroupAssets,
  fetchAssetBuffer,
  uploadDocumentBuffer,
} from '../services/cloudinary.service';
import { buildDocumentBaseName, documentLabel } from '../utils/documentNaming';
import { recordAudit } from '../services/audit.service';
import { AuditAction, DocumentStatus, DocumentType, PdfStatus } from '../types/enums';
import { env } from '../config/env';

const PDF_MIME = 'application/pdf';
export const MAX_OTHER_DOCUMENTS = 5;
const MAX_CUSTOM_NAME_LENGTH = 80;

function parseCustomName(value: unknown): string {
  return typeof value === 'string' ? value.trim().slice(0, MAX_CUSTOM_NAME_LENGTH) : '';
}

async function loadLeadOrThrow(id: string) {
  if (!Types.ObjectId.isValid(id)) throw ApiError.notFound('Lead not found');
  const lead = await Lead.findById(id);
  if (!lead) throw ApiError.notFound('Lead not found');
  return lead;
}

async function loadLeadByDocumentOrThrow(documentId: string) {
  const lead = await Lead.findOne({ 'documents._id': documentId });
  if (!lead) throw ApiError.notFound('Document not found');
  const doc = lead.documents.id(documentId);
  if (!doc) throw ApiError.notFound('Document not found');
  return { lead, doc };
}

function isPdfOnly(doc: ILeadDocument): boolean {
  return doc.pages.length === 1 && doc.pages[0].mimeType === PDF_MIME;
}

/** Pages in their authoritative display/print order - never the raw array order. */
function orderedPages(doc: ILeadDocument): IDocumentPage[] {
  return [...doc.pages].sort((a, b) => a.pageNumber - b.pageNumber);
}

/**
 * (Re)builds the usable PDF for a document group from its current pages, and
 * writes the result onto `doc` (pdfFile + pdfStatus). Does not save the lead
 * - callers save once after this returns.
 *
 * - A document made of a single uploaded PDF needs no conversion: pdfFile
 *   simply mirrors that same asset.
 * - A document made of one or more images is rebuilt from scratch each time
 *   (re-fetching any previously-uploaded pages, in pageNumber order) and
 *   re-uploaded as a fresh PDF asset; the previous PDF asset, if any, is
 *   deleted afterward.
 *
 * `opts.newFileForPageId` identifies which page (by _id) was just
 * uploaded/replaced in this request, so its buffer can be used directly
 * instead of re-fetching it from Cloudinary - this page is not necessarily
 * the last one in the array (e.g. when retaking an earlier page).
 *
 * This keeps things synchronous and re-fetches all other pages on every
 * change rather than introducing incremental PDF editing or a job queue -
 * documents are a handful of already-compressed images, so this stays fast,
 * and it only ever runs when the page set/order actually changed.
 */
async function regenerateDocumentPdf(
  lead: ILead,
  doc: ILeadDocument,
  opts: { newFileBuffer?: Buffer; newFileForPageId?: string } = {},
): Promise<void> {
  const previousPdf = doc.pdfFile;

  try {
    if (isPdfOnly(doc)) {
      const only = doc.pages[0];
      doc.pdfFile = {
        cloudinaryPublicId: only.cloudinaryPublicId,
        resourceType: only.resourceType,
        fileSize: only.fileSize,
        generatedAt: new Date(),
      } as any;
      doc.pdfStatus = PdfStatus.READY;
    } else {
      const pages = orderedPages(doc);
      const buffers: Buffer[] = [];
      for (const page of pages) {
        if (opts.newFileBuffer && opts.newFileForPageId && page._id.toString() === opts.newFileForPageId) {
          buffers.push(opts.newFileBuffer);
        } else {
          buffers.push(await fetchAssetBuffer(page.cloudinaryPublicId, page.resourceType));
        }
      }

      const pdfBuffer = await imagesToPdf(buffers);
      const uploadResult = await uploadDocumentBuffer(pdfBuffer, {
        leadId: lead.leadId,
        documentType: doc.documentType,
        mimeType: PDF_MIME,
        kind: 'pdf',
      });

      doc.pdfFile = {
        cloudinaryPublicId: uploadResult.publicId,
        resourceType: uploadResult.resourceType,
        fileSize: pdfBuffer.length,
        generatedAt: new Date(),
      } as any;
      doc.pdfStatus = PdfStatus.READY;

      // Clean up the superseded PDF asset now that the new one is confirmed uploaded.
      if (previousPdf && previousPdf.cloudinaryPublicId !== uploadResult.publicId) {
        await deleteDocumentAsset(previousPdf.cloudinaryPublicId, previousPdf.resourceType);
      }
    }
  } catch (err) {
    console.error('[pdf] generation failed for document', doc._id.toString(), (err as Error).message);
    doc.pdfStatus = PdfStatus.FAILED;
  }
}

/** Renumbers pages 1..N in their current pageNumber order - closes any gap left by a removal. */
function renumberPages(doc: ILeadDocument): void {
  orderedPages(doc).forEach((page, i) => {
    page.pageNumber = i + 1;
  });
}

type UploadMode = 'replace' | 'append' | 'replace-page';

export const uploadDocument = catchAsync(async (req: Request, res: Response) => {
  const lead = await loadLeadOrThrow(req.params.id);
  if (!canAccessLead(lead, req.user!)) throw ApiError.forbidden("You don't have permission to access this lead.");

  const file = req.file;
  if (!file) throw ApiError.badRequest('No file was uploaded.');

  const { documentType } = req.body;
  if (!documentType) throw ApiError.badRequest('documentType is required.');

  const mode: UploadMode =
    req.body.mode === 'append' ? 'append' : req.body.mode === 'replace-page' ? 'replace-page' : 'replace';

  // A lead can hold several Other Documents, so an upload targets a specific
  // document by id when one is given. Without an id, an Other Document upload
  // always starts a new, separately named document; every other type has at
  // most one document, found by its type.
  const isOther = documentType === DocumentType.OTHER;
  const customName = parseCustomName(req.body.customName);
  let doc: ILeadDocument | undefined;
  if (req.body.documentId) {
    doc = lead.documents.find((d) => d._id.toString() === req.body.documentId);
    if (!doc || doc.documentType !== documentType) throw ApiError.notFound('Document not found.');
  } else if (isOther) {
    if (mode !== 'replace') throw ApiError.badRequest('documentId is required to change an existing Other Document.');
    if (!customName) throw ApiError.badRequest('Please give this document a name.');
    if (lead.documents.filter((d) => d.documentType === DocumentType.OTHER).length >= MAX_OTHER_DOCUMENTS) {
      throw ApiError.badRequest(`You can add at most ${MAX_OTHER_DOCUMENTS} other documents.`);
    }
  } else {
    doc = lead.documents.find((d) => d.documentType === documentType);
  }

  if (mode === 'replace-page') {
    if (!doc) throw ApiError.badRequest('This document does not exist yet, so there is no page to replace.');
    const pageId = req.body.pageId;
    if (!pageId) throw ApiError.badRequest('pageId is required to replace a specific page.');
    const targetPage = doc.pages.id(pageId);
    if (!targetPage) throw ApiError.notFound('Page not found.');
    if (file.mimetype === PDF_MIME && doc.pages.length > 1) {
      throw ApiError.badRequest('A PDF cannot replace a single page in a multi-page document. Replace the whole document instead.');
    }

    const isPdfUpload = file.mimetype === PDF_MIME;
    const bufferToStore = isPdfUpload ? file.buffer : await optimizeImageBuffer(file.buffer, file.mimetype);

    const uploadResult = await uploadDocumentBuffer(bufferToStore, {
      leadId: lead.leadId,
      documentType,
      mimeType: file.mimetype,
      kind: 'original',
    });

    await deleteDocumentAsset(targetPage.cloudinaryPublicId, targetPage.resourceType);

    targetPage.cloudinaryPublicId = uploadResult.publicId;
    targetPage.resourceType = uploadResult.resourceType;
    targetPage.mimeType = file.mimetype;
    targetPage.originalName = file.originalname;
    targetPage.fileSize = bufferToStore.length;
    targetPage.uploadedAt = new Date();
    doc.status = DocumentStatus.UPLOADED;
    doc.uploadedBy = req.user!.id as any;
    doc.uploadedAt = new Date();
    doc.pdfStatus = PdfStatus.PROCESSING;

    await regenerateDocumentPdf(lead, doc, {
      newFileBuffer: isPdfUpload ? undefined : bufferToStore,
      newFileForPageId: targetPage._id.toString(),
    });

    await lead.save();

    await recordAudit({
      action: AuditAction.DOCUMENT_UPLOADED,
      actor: { id: req.user!.id, name: req.user!.name, role: req.user!.role },
      targetType: 'Lead',
      targetId: lead._id.toString(),
      targetLabel: `${lead.leadId} - ${documentLabel(doc)}`,
      details: `Retook page ${targetPage.pageNumber}`,
      req,
    });

    return res.status(201).json({ document: doc });
  }

  if (mode === 'append' && doc && isPdfOnly(doc)) {
    throw ApiError.badRequest('This document is a single PDF file. Replace it instead of adding a page.');
  }
  if (mode === 'append' && file.mimetype === PDF_MIME) {
    throw ApiError.badRequest('A PDF page cannot be added to an existing document. Replace it instead.');
  }
  if (mode === 'append' && doc && doc.pages.length >= env.maxDocumentPages) {
    throw ApiError.badRequest(`A document can have at most ${env.maxDocumentPages} pages.`);
  }

  // Starting over (default) clears whatever was there before, exactly like the
  // previous single-file model did - the new upload becomes the only page.
  if (mode === 'replace' && doc) {
    await deleteDocumentGroupAssets(doc);
    doc.pages.splice(0, doc.pages.length);
    doc.pdfFile = undefined;
  }

  if (!doc) {
    lead.documents.push({
      documentType,
      customName: isOther ? customName : undefined,
      pages: [],
      pdfStatus: PdfStatus.PROCESSING,
      status: DocumentStatus.UPLOADED,
      uploadedBy: req.user!.id,
      uploadedAt: new Date(),
    } as any);
    doc = lead.documents[lead.documents.length - 1];
  }

  const isPdfUpload = file.mimetype === PDF_MIME;
  const bufferToStore = isPdfUpload ? file.buffer : await optimizeImageBuffer(file.buffer, file.mimetype);

  const uploadResult = await uploadDocumentBuffer(bufferToStore, {
    leadId: lead.leadId,
    documentType,
    mimeType: file.mimetype,
    kind: 'original',
  });

  const nextPageNumber = doc.pages.length > 0 ? Math.max(...doc.pages.map((p) => p.pageNumber)) + 1 : 1;

  doc.pages.push({
    pageNumber: nextPageNumber,
    cloudinaryPublicId: uploadResult.publicId,
    resourceType: uploadResult.resourceType,
    mimeType: file.mimetype,
    originalName: file.originalname,
    fileSize: bufferToStore.length,
    uploadedAt: new Date(),
  } as any);
  const pushedPage = doc.pages[doc.pages.length - 1];
  doc.status = DocumentStatus.UPLOADED;
  doc.uploadedBy = req.user!.id as any;
  doc.uploadedAt = new Date();
  doc.pdfStatus = PdfStatus.PROCESSING;

  await regenerateDocumentPdf(lead, doc, {
    newFileBuffer: isPdfUpload ? undefined : bufferToStore,
    newFileForPageId: pushedPage._id.toString(),
  });

  await lead.save();

  await recordAudit({
    action: AuditAction.DOCUMENT_UPLOADED,
    actor: { id: req.user!.id, name: req.user!.name, role: req.user!.role },
    targetType: 'Lead',
    targetId: lead._id.toString(),
    targetLabel: `${lead.leadId} - ${documentLabel(doc)}`,
    details: mode === 'append' ? 'Added a page' : 'Uploaded',
    req,
  });

  res.status(201).json({ document: doc });
});

export const listDocuments = catchAsync(async (req: Request, res: Response) => {
  const lead = await loadLeadOrThrow(req.params.id);
  if (!canAccessLead(lead, req.user!)) throw ApiError.forbidden("You don't have permission to access this lead.");
  res.json({ documents: lead.documents });
});

export const getDocumentAccess = catchAsync(async (req: Request, res: Response) => {
  const { lead, doc } = await loadLeadByDocumentOrThrow(req.params.documentId);
  if (!canAccessLead(lead, req.user!)) throw ApiError.forbidden("You don't have permission to access this document.");

  const action = req.query.action === 'download' ? 'download' : 'view';
  const variant = req.query.variant === 'original' ? 'original' : 'pdf';
  const index = Math.max(0, Number(req.query.index ?? 0) || 0);

  let asset: { cloudinaryPublicId: string; resourceType: string };
  let extensionHint: string;

  if (variant === 'pdf') {
    if (!doc.pdfFile) throw ApiError.notFound('No PDF is available for this document yet.');
    asset = doc.pdfFile;
    extensionHint = 'pdf';
  } else {
    const pages = orderedPages(doc);
    const page = pages[index];
    if (!page) throw ApiError.notFound('Page not found.');
    asset = page;
    extensionHint = page.mimeType === PDF_MIME ? 'pdf' : page.mimeType.split('/')[1] || 'jpg';
  }

  const customerName = lead.customerBasicDetails?.fullName;
  const baseName = buildDocumentBaseName(lead.leadId, customerName, documentLabel(doc));
  const suffix = variant === 'original' && doc.pages.length > 1 ? `_page${index + 1}` : '';

  const url =
    action === 'download'
      ? buildSignedDownloadUrl(asset.cloudinaryPublicId, asset.resourceType, `${baseName}${suffix}`, extensionHint)
      : buildSignedViewUrl(asset.cloudinaryPublicId, asset.resourceType, extensionHint);

  await recordAudit({
    action: action === 'download' ? AuditAction.DOCUMENT_DOWNLOADED : AuditAction.DOCUMENT_VIEWED,
    actor: { id: req.user!.id, name: req.user!.name, role: req.user!.role },
    targetType: 'Lead',
    targetId: lead._id.toString(),
    targetLabel: `${lead.leadId} - ${documentLabel(doc)} (${variant})`,
    req,
  });

  res.json({ url, expiresInSeconds: 300, documentType: doc.documentType, variant });
});

/** Renames an Other Document. Standard document types keep their fixed names. */
export const renameDocument = catchAsync(async (req: Request, res: Response) => {
  const { lead, doc } = await loadLeadByDocumentOrThrow(req.params.documentId);
  if (!canAccessLead(lead, req.user!)) throw ApiError.forbidden("You don't have permission to access this document.");
  if (doc.documentType !== DocumentType.OTHER) throw ApiError.badRequest('Only Other Documents can be renamed.');

  const customName = parseCustomName(req.body.customName);
  if (!customName) throw ApiError.badRequest('Please give this document a name.');

  const previousName = documentLabel(doc);
  doc.customName = customName;
  await lead.save();

  await recordAudit({
    action: AuditAction.LEAD_UPDATED,
    actor: { id: req.user!.id, name: req.user!.name, role: req.user!.role },
    targetType: 'Lead',
    targetId: lead._id.toString(),
    targetLabel: `${lead.leadId} - ${customName}`,
    details: `Renamed document from "${previousName}"`,
    req,
  });

  res.json({ document: doc });
});

export const regeneratePdf = catchAsync(async (req: Request, res: Response) => {
  const { lead, doc } = await loadLeadByDocumentOrThrow(req.params.documentId);
  if (!canAccessLead(lead, req.user!)) throw ApiError.forbidden("You don't have permission to access this document.");

  if (doc.pages.length === 0) throw ApiError.badRequest('This document has no uploaded files to convert.');

  await regenerateDocumentPdf(lead, doc);
  await lead.save();

  await recordAudit({
    action: AuditAction.DOCUMENT_PDF_REGENERATED,
    actor: { id: req.user!.id, name: req.user!.name, role: req.user!.role },
    targetType: 'Lead',
    targetId: lead._id.toString(),
    targetLabel: `${lead.leadId} - ${documentLabel(doc)}`,
    req,
  });

  res.json({ document: doc });
});

/**
 * Removes one page and closes the gap in the remaining page numbers (e.g.
 * removing page 2 of 3 leaves 1, 2 - never 1, 3). Removing the only
 * remaining page deletes the whole document group instead of leaving an
 * empty, unusable shell.
 */
export const removePage = catchAsync(async (req: Request, res: Response) => {
  const { lead, doc } = await loadLeadByDocumentOrThrow(req.params.documentId);
  if (!canAccessLead(lead, req.user!)) throw ApiError.forbidden("You don't have permission to access this document.");

  const page = doc.pages.id(req.params.pageId);
  if (!page) throw ApiError.notFound('Page not found.');

  if (doc.pages.length === 1) {
    await deleteDocumentGroupAssets(doc);
    const documentType = documentLabel(doc);
    lead.documents.pull({ _id: doc._id });
    await lead.save();

    await recordAudit({
      action: AuditAction.DOCUMENT_DELETED,
      actor: { id: req.user!.id, name: req.user!.name, role: req.user!.role },
      targetType: 'Lead',
      targetId: lead._id.toString(),
      targetLabel: `${lead.leadId} - ${documentType}`,
      details: 'Removed the only page',
      req,
    });

    return res.json({ deleted: true });
  }

  await deleteDocumentAsset(page.cloudinaryPublicId, page.resourceType);
  const removedPageNumber = page.pageNumber;
  doc.pages.pull({ _id: req.params.pageId });
  renumberPages(doc);
  doc.pdfStatus = PdfStatus.PROCESSING;

  await regenerateDocumentPdf(lead, doc);
  await lead.save();

  await recordAudit({
    action: AuditAction.DOCUMENT_PAGE_REMOVED,
    actor: { id: req.user!.id, name: req.user!.name, role: req.user!.role },
    targetType: 'Lead',
    targetId: lead._id.toString(),
    targetLabel: `${lead.leadId} - ${documentLabel(doc)}`,
    details: `Removed page ${removedPageNumber}`,
    req,
  });

  res.json({ document: doc });
});

/**
 * Reassigns pageNumber for every page of a document to match the order the
 * client sends (a full permutation of that document's current page ids).
 * This is a metadata-only change - no assets move - so it stays cheap; the
 * PDF is then rebuilt in the new order.
 */
export const reorderPages = catchAsync(async (req: Request, res: Response) => {
  const { lead, doc } = await loadLeadByDocumentOrThrow(req.params.documentId);
  if (!canAccessLead(lead, req.user!)) throw ApiError.forbidden("You don't have permission to access this document.");

  const pageIds = req.body.pageIds;
  if (!Array.isArray(pageIds) || pageIds.length !== doc.pages.length) {
    throw ApiError.badRequest('pageIds must include every page of this document exactly once.');
  }

  const currentIds = new Set(doc.pages.map((p) => p._id.toString()));
  const uniqueGiven = new Set(pageIds);
  if (uniqueGiven.size !== pageIds.length || pageIds.some((id: unknown) => typeof id !== 'string' || !currentIds.has(id))) {
    throw ApiError.badRequest("pageIds must be a permutation of this document's current pages.");
  }

  pageIds.forEach((id: string, i: number) => {
    doc.pages.id(id)!.pageNumber = i + 1;
  });
  doc.pdfStatus = PdfStatus.PROCESSING;

  await regenerateDocumentPdf(lead, doc);
  await lead.save();

  await recordAudit({
    action: AuditAction.DOCUMENT_PAGES_REORDERED,
    actor: { id: req.user!.id, name: req.user!.name, role: req.user!.role },
    targetType: 'Lead',
    targetId: lead._id.toString(),
    targetLabel: `${lead.leadId} - ${documentLabel(doc)}`,
    req,
  });

  res.json({ document: doc });
});

export const deleteDocument = catchAsync(async (req: Request, res: Response) => {
  const { lead, doc } = await loadLeadByDocumentOrThrow(req.params.documentId);
  if (!canAccessLead(lead, req.user!)) throw ApiError.forbidden("You don't have permission to access this document.");

  await deleteDocumentGroupAssets(doc);

  const documentType = documentLabel(doc);
  lead.documents.pull({ _id: req.params.documentId });
  await lead.save();

  await recordAudit({
    action: AuditAction.DOCUMENT_DELETED,
    actor: { id: req.user!.id, name: req.user!.name, role: req.user!.role },
    targetType: 'Lead',
    targetId: lead._id.toString(),
    targetLabel: `${lead.leadId} - ${documentType}`,
    req,
  });

  res.json({ success: true });
});

export const downloadAllPdfs = catchAsync(async (req: Request, res: Response) => {
  const lead = await loadLeadOrThrow(req.params.id);
  if (!canAccessLead(lead, req.user!)) throw ApiError.forbidden("You don't have permission to access this lead.");

  const ready = lead.documents.filter((d) => d.pdfStatus === PdfStatus.READY && d.pdfFile);
  if (ready.length === 0) {
    throw ApiError.badRequest('No PDFs are ready to download yet for this lead.');
  }

  const customerName = lead.customerBasicDetails?.fullName;
  const zipName = buildDocumentBaseName(lead.leadId, customerName, 'Documents');

  // Fetch every PDF's bytes up front, before writing any response headers, so
  // a total failure (e.g. every fetch erroring) can still be reported as a
  // clean error response instead of silently streaming a 200 OK empty ZIP -
  // a real failure mode when Cloudinary's PDF delivery isn't reachable.
  const fetched: { name: string; buffer: Buffer }[] = [];
  const skipped: string[] = [];
  const usedNames = new Set<string>();
  for (const doc of ready) {
    const label = documentLabel(doc);
    try {
      const buffer = await fetchAssetBuffer(doc.pdfFile!.cloudinaryPublicId, doc.pdfFile!.resourceType);
      // Two Other Documents may share a name; keep every ZIP entry distinct.
      const base = buildDocumentBaseName(lead.leadId, customerName, label);
      let name = base;
      for (let n = 2; usedNames.has(name); n++) name = `${base}_${n}`;
      usedNames.add(name);
      fetched.push({ name: `${name}.pdf`, buffer });
    } catch (err) {
      console.error('[zip] skipped a document that failed to fetch', label, (err as Error).message);
      skipped.push(label);
    }
  }

  if (fetched.length === 0) {
    throw ApiError.internal(
      'Could not retrieve any PDFs for this lead right now. Please try again, or check the Cloudinary configuration.',
    );
  }

  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="${zipName}.zip"`);
  if (skipped.length > 0) {
    res.setHeader('X-Skipped-Documents', encodeURIComponent(skipped.join(', ')));
  }

  const archive = archiver('zip', { zlib: { level: 9 } });
  archive.on('error', (err) => {
    console.error('[zip] archive error for lead', lead.leadId, err.message);
    if (!res.headersSent) res.status(500);
    res.end();
  });
  archive.pipe(res);

  for (const file of fetched) {
    archive.append(file.buffer, { name: file.name });
  }

  await archive.finalize();

  await recordAudit({
    action: AuditAction.DOCUMENTS_BULK_DOWNLOADED,
    actor: { id: req.user!.id, name: req.user!.name, role: req.user!.role },
    targetType: 'Lead',
    targetId: lead._id.toString(),
    targetLabel: lead.leadId,
    details: `${ready.length}/${lead.documents.length} PDFs`,
    req,
  });
});
