import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import { createUser, authCookieFor } from './helpers';
import { UserRole } from '../src/types/enums';

const mockUploadDocumentBuffer = vi.fn().mockResolvedValue({
  publicId: 'mock-public-id',
  resourceType: 'image',
  bytes: 1234,
  format: 'jpg',
});

vi.mock('../src/services/cloudinary.service', () => ({
  uploadDocumentBuffer: (...args: unknown[]) => mockUploadDocumentBuffer(...args),
  buildSignedViewUrl: vi.fn().mockReturnValue('https://res.cloudinary.com/test/mock-signed-view-url'),
  buildSignedDownloadUrl: vi.fn().mockReturnValue('https://res.cloudinary.com/test/mock-signed-download-url'),
  deleteDocumentAsset: vi.fn().mockResolvedValue(undefined),
  deleteDocumentGroupAssets: vi.fn().mockResolvedValue(undefined),
  fetchAssetBuffer: vi.fn().mockResolvedValue(Buffer.from('mock-pdf-bytes-for-fetch')),
}));

vi.mock('../src/services/image.service', () => ({
  optimizeImageBuffer: vi.fn(async (buffer: Buffer) => buffer),
}));

vi.mock('../src/services/pdf.service', () => ({
  imagesToPdf: vi.fn(async () => Buffer.from('%PDF-mock-generated-pdf')),
}));

const { app } = await import('../src/app');

function attachImage(req: request.Test, filename = 'aadhaar.jpg') {
  return req.attach('file', Buffer.from('fake-image-bytes'), { filename, contentType: 'image/jpeg' });
}

function attachPdf(req: request.Test, filename = 'bill.pdf') {
  return req.attach('file', Buffer.from('%PDF-fake-bytes'), { filename, contentType: 'application/pdf' });
}

describe('Document upload & PDF generation', () => {
  it('uploads an image, stores the original, and generates a READY PDF', async () => {
    const { user: agent } = await createUser({ role: UserRole.AGENT });
    const created = await request(app).post('/api/leads').set('Cookie', authCookieFor(agent)).send({});
    const leadId = created.body.lead._id;

    const res = await attachImage(
      request(app).post(`/api/leads/${leadId}/documents`).set('Cookie', authCookieFor(agent)).field('documentType', 'Aadhaar Card'),
    );

    expect(res.status).toBe(201);
    expect(res.body.document.documentType).toBe('Aadhaar Card');
    expect(res.body.document.pages).toHaveLength(1);
    expect(res.body.document.pages[0].pageNumber).toBe(1);
    expect(res.body.document.pages[0].cloudinaryPublicId).toBe('mock-public-id');
    expect(res.body.document.pdfStatus).toBe('READY');
    expect(res.body.document.pdfFile.cloudinaryPublicId).toBe('mock-public-id');
    // Original + generated PDF = two separate Cloudinary uploads.
    expect(mockUploadDocumentBuffer).toHaveBeenCalledTimes(2);
    expect(mockUploadDocumentBuffer.mock.calls[0][1].kind).toBe('original');
    expect(mockUploadDocumentBuffer.mock.calls[1][1].kind).toBe('pdf');
  });

  it('does not re-convert an uploaded PDF - it becomes the usable PDF as-is', async () => {
    mockUploadDocumentBuffer.mockClear();
    const { user: agent } = await createUser({ role: UserRole.AGENT });
    const created = await request(app).post('/api/leads').set('Cookie', authCookieFor(agent)).send({});
    const leadId = created.body.lead._id;

    const res = await attachPdf(
      request(app).post(`/api/leads/${leadId}/documents`).set('Cookie', authCookieFor(agent)).field('documentType', 'Electricity Bill'),
    );

    expect(res.status).toBe(201);
    expect(res.body.document.pages).toHaveLength(1);
    expect(res.body.document.pdfStatus).toBe('READY');
    // The PDF mirrors the original asset directly - only one Cloudinary upload call, no conversion pass.
    expect(mockUploadDocumentBuffer).toHaveBeenCalledTimes(1);
    expect(res.body.document.pdfFile.cloudinaryPublicId).toBe(res.body.document.pages[0].cloudinaryPublicId);
  });

  it('combines a second appended image into the same document as an additional page, not a new document', async () => {
    const { user: agent } = await createUser({ role: UserRole.AGENT });
    const created = await request(app).post('/api/leads').set('Cookie', authCookieFor(agent)).send({});
    const leadId = created.body.lead._id;

    const first = await attachImage(
      request(app).post(`/api/leads/${leadId}/documents`).set('Cookie', authCookieFor(agent)).field('documentType', 'Aadhaar Card'),
      'aadhaar-front.jpg',
    );
    const firstDocId = first.body.document._id;

    const second = await attachImage(
      request(app)
        .post(`/api/leads/${leadId}/documents`)
        .set('Cookie', authCookieFor(agent))
        .field('documentType', 'Aadhaar Card')
        .field('mode', 'append'),
      'aadhaar-back.jpg',
    );

    expect(second.status).toBe(201);
    expect(second.body.document._id).toBe(firstDocId); // same document group, not a new one
    expect(second.body.document.pages).toHaveLength(2);
    expect(second.body.document.pages[0].pageNumber).toBe(1);
    expect(second.body.document.pages[1].pageNumber).toBe(2);
    expect(second.body.document.pdfStatus).toBe('READY');

    const list = await request(app).get(`/api/leads/${leadId}/documents`).set('Cookie', authCookieFor(agent));
    expect(list.body.documents).toHaveLength(1); // still one logical "Aadhaar Card" document
  });

  it('replacing a document (default mode) clears prior pages instead of accumulating them', async () => {
    const { user: agent } = await createUser({ role: UserRole.AGENT });
    const created = await request(app).post('/api/leads').set('Cookie', authCookieFor(agent)).send({});
    const leadId = created.body.lead._id;

    await attachImage(
      request(app).post(`/api/leads/${leadId}/documents`).set('Cookie', authCookieFor(agent)).field('documentType', 'PAN Card'),
    );
    const replaced = await attachImage(
      request(app).post(`/api/leads/${leadId}/documents`).set('Cookie', authCookieFor(agent)).field('documentType', 'PAN Card'),
      'pan-retake.jpg',
    );

    expect(replaced.body.document.pages).toHaveLength(1);
    expect(replaced.body.document.pages[0].originalName).toBe('pan-retake.jpg');
    expect(replaced.body.document.pages[0].pageNumber).toBe(1);
  });

  it('rejects appending a page onto a PDF-only document', async () => {
    const { user: agent } = await createUser({ role: UserRole.AGENT });
    const created = await request(app).post('/api/leads').set('Cookie', authCookieFor(agent)).send({});
    const leadId = created.body.lead._id;

    await attachPdf(
      request(app).post(`/api/leads/${leadId}/documents`).set('Cookie', authCookieFor(agent)).field('documentType', 'Bank Passbook'),
    );

    const res = await attachImage(
      request(app)
        .post(`/api/leads/${leadId}/documents`)
        .set('Cookie', authCookieFor(agent))
        .field('documentType', 'Bank Passbook')
        .field('mode', 'append'),
    );

    expect(res.status).toBe(400);
  });

  it('rejects a file over the 15MB size limit', async () => {
    const { user: agent } = await createUser({ role: UserRole.AGENT });
    const created = await request(app).post('/api/leads').set('Cookie', authCookieFor(agent)).send({});
    const leadId = created.body.lead._id;

    const oversizedBuffer = Buffer.alloc(16 * 1024 * 1024, 1);

    const res = await request(app)
      .post(`/api/leads/${leadId}/documents`)
      .set('Cookie', authCookieFor(agent))
      .field('documentType', 'Aadhaar Card')
      .attach('file', oversizedBuffer, { filename: 'huge.jpg', contentType: 'image/jpeg' });

    expect(res.status).toBe(400);
  });

  it('rejects an unsupported file type', async () => {
    const { user: agent } = await createUser({ role: UserRole.AGENT });
    const created = await request(app).post('/api/leads').set('Cookie', authCookieFor(agent)).send({});
    const leadId = created.body.lead._id;

    const res = await request(app)
      .post(`/api/leads/${leadId}/documents`)
      .set('Cookie', authCookieFor(agent))
      .field('documentType', 'Aadhaar Card')
      .attach('file', Buffer.from('not-a-real-doc'), { filename: 'virus.exe', contentType: 'application/x-msdownload' });

    expect(res.status).toBe(400);
  });

  it('rejects uploads to a lead the agent does not own', async () => {
    const { user: owner } = await createUser({ role: UserRole.AGENT });
    const { user: intruder } = await createUser({ role: UserRole.AGENT });
    const created = await request(app).post('/api/leads').set('Cookie', authCookieFor(owner)).send({});
    const leadId = created.body.lead._id;

    const res = await attachImage(
      request(app).post(`/api/leads/${leadId}/documents`).set('Cookie', authCookieFor(intruder)).field('documentType', 'Aadhaar Card'),
    );

    expect(res.status).toBe(403);
  });

  it('marks the document FAILED (without losing the original) when PDF generation throws, and regenerate-pdf can retry it', async () => {
    const pdfServiceModule = await import('../src/services/pdf.service');
    const imagesToPdfMock = vi.mocked(pdfServiceModule.imagesToPdf);
    imagesToPdfMock.mockRejectedValueOnce(new Error('simulated PDF generation failure'));

    const { user: agent } = await createUser({ role: UserRole.AGENT });
    const created = await request(app).post('/api/leads').set('Cookie', authCookieFor(agent)).send({});
    const leadId = created.body.lead._id;

    const uploadRes = await attachImage(
      request(app).post(`/api/leads/${leadId}/documents`).set('Cookie', authCookieFor(agent)).field('documentType', 'Aadhaar Card'),
    );

    expect(uploadRes.body.document.pdfStatus).toBe('FAILED');
    expect(uploadRes.body.document.pages).toHaveLength(1); // original is never lost on failure

    const documentId = uploadRes.body.document._id;
    const retryRes = await request(app)
      .post(`/api/documents/${documentId}/regenerate-pdf`)
      .set('Cookie', authCookieFor(agent));

    expect(retryRes.status).toBe(200);
    expect(retryRes.body.document.pdfStatus).toBe('READY');
  });
});

describe('Document access control', () => {
  it('grants a signed access URL only to an authorized user', async () => {
    const { user: owner } = await createUser({ role: UserRole.AGENT });
    const { user: intruder } = await createUser({ role: UserRole.AGENT });
    const created = await request(app).post('/api/leads').set('Cookie', authCookieFor(owner)).send({});
    const leadId = created.body.lead._id;

    const uploadRes = await attachImage(
      request(app).post(`/api/leads/${leadId}/documents`).set('Cookie', authCookieFor(owner)).field('documentType', 'Aadhaar Card'),
    );
    const documentId = uploadRes.body.document._id;

    const authorized = await request(app).get(`/api/documents/${documentId}/access`).set('Cookie', authCookieFor(owner));
    expect(authorized.status).toBe(200);
    expect(authorized.body.url).toContain('mock-signed-view-url');

    const unauthorized = await request(app).get(`/api/documents/${documentId}/access`).set('Cookie', authCookieFor(intruder));
    expect(unauthorized.status).toBe(403);
  });

  it('allows an admin to access documents on any lead', async () => {
    const { user: owner } = await createUser({ role: UserRole.AGENT });
    const { user: admin } = await createUser({ role: UserRole.ADMIN });
    const created = await request(app).post('/api/leads').set('Cookie', authCookieFor(owner)).send({});
    const leadId = created.body.lead._id;

    const uploadRes = await attachImage(
      request(app).post(`/api/leads/${leadId}/documents`).set('Cookie', authCookieFor(owner)).field('documentType', 'PAN Card'),
    );

    const res = await request(app).get(`/api/documents/${uploadRes.body.document._id}/access`).set('Cookie', authCookieFor(admin));
    expect(res.status).toBe(200);
  });

  it('rejects regenerate-pdf from a user who does not own the lead', async () => {
    const { user: owner } = await createUser({ role: UserRole.AGENT });
    const { user: intruder } = await createUser({ role: UserRole.AGENT });
    const created = await request(app).post('/api/leads').set('Cookie', authCookieFor(owner)).send({});
    const leadId = created.body.lead._id;

    const uploadRes = await attachImage(
      request(app).post(`/api/leads/${leadId}/documents`).set('Cookie', authCookieFor(owner)).field('documentType', 'Aadhaar Card'),
    );

    const res = await request(app)
      .post(`/api/documents/${uploadRes.body.document._id}/regenerate-pdf`)
      .set('Cookie', authCookieFor(intruder));
    expect(res.status).toBe(403);
  });
});

describe('Page management (retake, remove, reorder)', () => {
  it('replaces a specific page (retake) without changing its position or other pages', async () => {
    mockUploadDocumentBuffer.mockClear();
    const { user: agent } = await createUser({ role: UserRole.AGENT });
    const created = await request(app).post('/api/leads').set('Cookie', authCookieFor(agent)).send({});
    const leadId = created.body.lead._id;

    const first = await attachImage(
      request(app).post(`/api/leads/${leadId}/documents`).set('Cookie', authCookieFor(agent)).field('documentType', 'Bank Passbook'),
      'page1-old.jpg',
    );
    const documentId = first.body.document._id;
    const second = await attachImage(
      request(app)
        .post(`/api/leads/${leadId}/documents`)
        .set('Cookie', authCookieFor(agent))
        .field('documentType', 'Bank Passbook')
        .field('mode', 'append'),
      'page2.jpg',
    );

    const sorted = [...second.body.document.pages].sort((a: any, b: any) => a.pageNumber - b.pageNumber);
    const page1Id = sorted[0]._id;
    const page2Id = sorted[1]._id;

    const retakeRes = await attachImage(
      request(app)
        .post(`/api/leads/${leadId}/documents`)
        .set('Cookie', authCookieFor(agent))
        .field('documentType', 'Bank Passbook')
        .field('mode', 'replace-page')
        .field('pageId', page1Id),
      'page1-new.jpg',
    );

    expect(retakeRes.status).toBe(201);
    const updated = [...retakeRes.body.document.pages].sort((a: any, b: any) => a.pageNumber - b.pageNumber);
    expect(updated).toHaveLength(2); // still 2 pages, not 3
    expect(updated[0]._id).toBe(page1Id); // same page identity/position
    expect(updated[0].pageNumber).toBe(1);
    expect(updated[0].originalName).toBe('page1-new.jpg');
    expect(updated[1]._id).toBe(page2Id); // page 2 untouched
  });

  it('removes a specific page and renumbers the remaining pages so there is no gap', async () => {
    mockUploadDocumentBuffer.mockClear();
    const cloudinaryModule = await import('../src/services/cloudinary.service');
    const fetchAssetBufferMock = vi.mocked(cloudinaryModule.fetchAssetBuffer);
    fetchAssetBufferMock.mockImplementation(async (publicId: string) => Buffer.from(`bytes-for-${publicId}`));
    mockUploadDocumentBuffer
      .mockResolvedValueOnce({ publicId: 'p1', resourceType: 'image', bytes: 1, format: 'jpg' })
      .mockResolvedValueOnce({ publicId: 'pdf1', resourceType: 'raw', bytes: 1, format: 'pdf' })
      .mockResolvedValueOnce({ publicId: 'p2', resourceType: 'image', bytes: 1, format: 'jpg' })
      .mockResolvedValueOnce({ publicId: 'pdf2', resourceType: 'raw', bytes: 1, format: 'pdf' })
      .mockResolvedValueOnce({ publicId: 'p3', resourceType: 'image', bytes: 1, format: 'jpg' })
      .mockResolvedValueOnce({ publicId: 'pdf3', resourceType: 'raw', bytes: 1, format: 'pdf' });

    const { user: agent } = await createUser({ role: UserRole.AGENT });
    const created = await request(app).post('/api/leads').set('Cookie', authCookieFor(agent)).send({});
    const leadId = created.body.lead._id;

    const first = await attachImage(
      request(app).post(`/api/leads/${leadId}/documents`).set('Cookie', authCookieFor(agent)).field('documentType', 'Aadhaar Card'),
      'p1.jpg',
    );
    const documentId = first.body.document._id;
    await attachImage(
      request(app)
        .post(`/api/leads/${leadId}/documents`)
        .set('Cookie', authCookieFor(agent))
        .field('documentType', 'Aadhaar Card')
        .field('mode', 'append'),
      'p2.jpg',
    );
    const third = await attachImage(
      request(app)
        .post(`/api/leads/${leadId}/documents`)
        .set('Cookie', authCookieFor(agent))
        .field('documentType', 'Aadhaar Card')
        .field('mode', 'append'),
      'p3.jpg',
    );

    const sorted = [...third.body.document.pages].sort((a: any, b: any) => a.pageNumber - b.pageNumber);
    const middlePageId = sorted[1]._id; // pageNumber 2 of 3

    const pdfServiceModule = await import('../src/services/pdf.service');
    const imagesToPdfMock = vi.mocked(pdfServiceModule.imagesToPdf);
    imagesToPdfMock.mockClear();

    const res = await request(app).delete(`/api/documents/${documentId}/pages/${middlePageId}`).set('Cookie', authCookieFor(agent));

    expect(res.status).toBe(200);
    const remaining = [...res.body.document.pages].sort((a: any, b: any) => a.pageNumber - b.pageNumber);
    expect(remaining).toHaveLength(2);
    expect(remaining.map((p: any) => p.pageNumber)).toEqual([1, 2]); // renumbered - no gap left
    expect(remaining.map((p: any) => p._id)).toEqual([sorted[0]._id, sorted[2]._id]); // page 1 and page 3 survive, in order

    expect(imagesToPdfMock).toHaveBeenCalledTimes(1);
    const buffersArg = imagesToPdfMock.mock.calls[0][0] as Buffer[];
    expect(buffersArg.map((b: Buffer) => b.toString())).toEqual(['bytes-for-p1', 'bytes-for-p3']);
  });

  it('removing the only remaining page deletes the whole document group', async () => {
    const { user: agent } = await createUser({ role: UserRole.AGENT });
    const created = await request(app).post('/api/leads').set('Cookie', authCookieFor(agent)).send({});
    const leadId = created.body.lead._id;

    const uploadRes = await attachImage(
      request(app).post(`/api/leads/${leadId}/documents`).set('Cookie', authCookieFor(agent)).field('documentType', 'PAN Card'),
    );
    const documentId = uploadRes.body.document._id;
    const pageId = uploadRes.body.document.pages[0]._id;

    const res = await request(app).delete(`/api/documents/${documentId}/pages/${pageId}`).set('Cookie', authCookieFor(agent));
    expect(res.status).toBe(200);
    expect(res.body.deleted).toBe(true);

    const list = await request(app).get(`/api/leads/${leadId}/documents`).set('Cookie', authCookieFor(agent));
    expect(list.body.documents).toHaveLength(0);
  });

  it('reorders pages and rebuilds the PDF in the new order (photo 1,2,3 -> 3,1,2)', async () => {
    mockUploadDocumentBuffer.mockClear();
    const cloudinaryModule = await import('../src/services/cloudinary.service');
    const fetchAssetBufferMock = vi.mocked(cloudinaryModule.fetchAssetBuffer);
    fetchAssetBufferMock.mockImplementation(async (publicId: string) => Buffer.from(`bytes-for-${publicId}`));
    mockUploadDocumentBuffer
      .mockResolvedValueOnce({ publicId: 'page-1-public-id', resourceType: 'image', bytes: 1, format: 'jpg' })
      .mockResolvedValueOnce({ publicId: 'pdf-after-1', resourceType: 'raw', bytes: 1, format: 'pdf' })
      .mockResolvedValueOnce({ publicId: 'page-2-public-id', resourceType: 'image', bytes: 1, format: 'jpg' })
      .mockResolvedValueOnce({ publicId: 'pdf-after-2', resourceType: 'raw', bytes: 1, format: 'pdf' })
      .mockResolvedValueOnce({ publicId: 'page-3-public-id', resourceType: 'image', bytes: 1, format: 'jpg' })
      .mockResolvedValueOnce({ publicId: 'pdf-after-3', resourceType: 'raw', bytes: 1, format: 'pdf' });

    const { user: agent } = await createUser({ role: UserRole.AGENT });
    const created = await request(app).post('/api/leads').set('Cookie', authCookieFor(agent)).send({});
    const leadId = created.body.lead._id;

    const p1 = await attachImage(
      request(app).post(`/api/leads/${leadId}/documents`).set('Cookie', authCookieFor(agent)).field('documentType', 'Bank Passbook'),
      'photo1.jpg',
    );
    const documentId = p1.body.document._id;
    await attachImage(
      request(app)
        .post(`/api/leads/${leadId}/documents`)
        .set('Cookie', authCookieFor(agent))
        .field('documentType', 'Bank Passbook')
        .field('mode', 'append'),
      'photo2.jpg',
    );
    const p3 = await attachImage(
      request(app)
        .post(`/api/leads/${leadId}/documents`)
        .set('Cookie', authCookieFor(agent))
        .field('documentType', 'Bank Passbook')
        .field('mode', 'append'),
      'photo3.jpg',
    );

    const sorted = [...p3.body.document.pages].sort((a: any, b: any) => a.pageNumber - b.pageNumber);
    const [id1, id2, id3] = sorted.map((p: any) => p._id);

    const pdfServiceModule = await import('../src/services/pdf.service');
    const imagesToPdfMock = vi.mocked(pdfServiceModule.imagesToPdf);
    imagesToPdfMock.mockClear();

    const reorderRes = await request(app)
      .patch(`/api/documents/${documentId}/pages/reorder`)
      .set('Cookie', authCookieFor(agent))
      .send({ pageIds: [id3, id1, id2] });

    expect(reorderRes.status).toBe(200);
    const newOrder = [...reorderRes.body.document.pages].sort((a: any, b: any) => a.pageNumber - b.pageNumber);
    expect(newOrder.map((p: any) => p._id)).toEqual([id3, id1, id2]);

    // The PDF must be rebuilt in the new order: photo3, photo1, photo2.
    expect(imagesToPdfMock).toHaveBeenCalledTimes(1);
    const buffersArg = imagesToPdfMock.mock.calls[0][0] as Buffer[];
    expect(buffersArg.map((b: Buffer) => b.toString())).toEqual([
      'bytes-for-page-3-public-id',
      'bytes-for-page-1-public-id',
      'bytes-for-page-2-public-id',
    ]);
  });

  it('rejects a reorder whose pageIds are not an exact permutation of the current pages', async () => {
    const { user: agent } = await createUser({ role: UserRole.AGENT });
    const created = await request(app).post('/api/leads').set('Cookie', authCookieFor(agent)).send({});
    const leadId = created.body.lead._id;

    const uploadRes = await attachImage(
      request(app).post(`/api/leads/${leadId}/documents`).set('Cookie', authCookieFor(agent)).field('documentType', 'Aadhaar Card'),
    );
    const documentId = uploadRes.body.document._id;

    const res = await request(app)
      .patch(`/api/documents/${documentId}/pages/reorder`)
      .set('Cookie', authCookieFor(agent))
      .send({ pageIds: ['not-a-real-page-id'] });

    expect(res.status).toBe(400);
  });

  it('rejects reorder and remove-page from a user who does not own the lead', async () => {
    const { user: owner } = await createUser({ role: UserRole.AGENT });
    const { user: intruder } = await createUser({ role: UserRole.AGENT });
    const created = await request(app).post('/api/leads').set('Cookie', authCookieFor(owner)).send({});
    const leadId = created.body.lead._id;

    const first = await attachImage(
      request(app).post(`/api/leads/${leadId}/documents`).set('Cookie', authCookieFor(owner)).field('documentType', 'Aadhaar Card'),
      'a.jpg',
    );
    const documentId = first.body.document._id;
    const second = await attachImage(
      request(app)
        .post(`/api/leads/${leadId}/documents`)
        .set('Cookie', authCookieFor(owner))
        .field('documentType', 'Aadhaar Card')
        .field('mode', 'append'),
      'b.jpg',
    );
    const pageId = second.body.document.pages[0]._id;

    const reorderRes = await request(app)
      .patch(`/api/documents/${documentId}/pages/reorder`)
      .set('Cookie', authCookieFor(intruder))
      .send({ pageIds: [pageId, second.body.document.pages[1]._id] });
    expect(reorderRes.status).toBe(403);

    const removeRes = await request(app).delete(`/api/documents/${documentId}/pages/${pageId}`).set('Cookie', authCookieFor(intruder));
    expect(removeRes.status).toBe(403);
  });

  it('rejects appending beyond the configured max pages per document', async () => {
    const { user: agent } = await createUser({ role: UserRole.AGENT });
    const created = await request(app).post('/api/leads').set('Cookie', authCookieFor(agent)).send({});
    const leadId = created.body.lead._id;

    await attachImage(
      request(app).post(`/api/leads/${leadId}/documents`).set('Cookie', authCookieFor(agent)).field('documentType', 'Bank Passbook'),
      'p0.jpg',
    );
    for (let i = 1; i < 10; i++) {
      const res = await attachImage(
        request(app)
          .post(`/api/leads/${leadId}/documents`)
          .set('Cookie', authCookieFor(agent))
          .field('documentType', 'Bank Passbook')
          .field('mode', 'append'),
        `p${i}.jpg`,
      );
      expect(res.status).toBe(201);
    }

    const overflow = await attachImage(
      request(app)
        .post(`/api/leads/${leadId}/documents`)
        .set('Cookie', authCookieFor(agent))
        .field('documentType', 'Bank Passbook')
        .field('mode', 'append'),
      'p10.jpg',
    );
    expect(overflow.status).toBe(400);
  });
});

describe('Download all PDFs (ZIP)', () => {
  it('streams a ZIP containing only this lead\'s READY PDFs, to an authorized user', async () => {
    const { user: agent } = await createUser({ role: UserRole.AGENT });
    const created = await request(app).post('/api/leads').set('Cookie', authCookieFor(agent)).send({});
    const leadId = created.body.lead._id;

    await attachImage(
      request(app).post(`/api/leads/${leadId}/documents`).set('Cookie', authCookieFor(agent)).field('documentType', 'Aadhaar Card'),
    );
    await attachPdf(
      request(app).post(`/api/leads/${leadId}/documents`).set('Cookie', authCookieFor(agent)).field('documentType', 'Electricity Bill'),
    );

    const res = await request(app)
      .get(`/api/leads/${leadId}/documents/download-all`)
      .set('Cookie', authCookieFor(agent))
      .buffer(true)
      .parse((response, callback) => {
        const chunks: Buffer[] = [];
        response.on('data', (chunk) => chunks.push(chunk));
        response.on('end', () => callback(null, Buffer.concat(chunks)));
      });

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toBe('application/zip');
    expect(res.headers['content-disposition']).toContain('.zip');
    expect((res.body as Buffer).length).toBeGreaterThan(0);
    // A ZIP file always starts with the "PK" local file header signature.
    expect((res.body as Buffer).subarray(0, 2).toString('utf-8')).toBe('PK');
  });

  it('rejects download-all from a user who does not own the lead', async () => {
    const { user: owner } = await createUser({ role: UserRole.AGENT });
    const { user: intruder } = await createUser({ role: UserRole.AGENT });
    const created = await request(app).post('/api/leads').set('Cookie', authCookieFor(owner)).send({});
    const leadId = created.body.lead._id;

    await attachImage(
      request(app).post(`/api/leads/${leadId}/documents`).set('Cookie', authCookieFor(owner)).field('documentType', 'Aadhaar Card'),
    );

    const res = await request(app).get(`/api/leads/${leadId}/documents/download-all`).set('Cookie', authCookieFor(intruder));
    expect(res.status).toBe(403);
  });

  it('returns 400 when no PDFs are ready yet for the lead', async () => {
    const { user: agent } = await createUser({ role: UserRole.AGENT });
    const created = await request(app).post('/api/leads').set('Cookie', authCookieFor(agent)).send({});
    const leadId = created.body.lead._id;

    const res = await request(app).get(`/api/leads/${leadId}/documents/download-all`).set('Cookie', authCookieFor(agent));
    expect(res.status).toBe(400);
  });

  it('fails cleanly instead of serving a silent empty ZIP when every PDF fetch fails', async () => {
    // Regression test: this is exactly what happened against a real Cloudinary
    // account with PDF delivery disabled - every fetchAssetBuffer call for a
    // "READY" document failed, and the endpoint used to still respond 200
    // with a technically-valid but empty (22-byte) ZIP.
    const cloudinaryModule = await import('../src/services/cloudinary.service');
    const fetchAssetBufferMock = vi.mocked(cloudinaryModule.fetchAssetBuffer);
    fetchAssetBufferMock.mockRejectedValueOnce(new Error('simulated: PDF delivery denied by Cloudinary'));

    const { user: agent } = await createUser({ role: UserRole.AGENT });
    const created = await request(app).post('/api/leads').set('Cookie', authCookieFor(agent)).send({});
    const leadId = created.body.lead._id;

    await attachImage(
      request(app).post(`/api/leads/${leadId}/documents`).set('Cookie', authCookieFor(agent)).field('documentType', 'Aadhaar Card'),
    );

    const res = await request(app).get(`/api/leads/${leadId}/documents/download-all`).set('Cookie', authCookieFor(agent));

    expect(res.status).toBe(500);
    expect(res.body.message).not.toMatch(/^PK/); // never a mis-served zip body
  });
});

describe('Multiple named Other Documents', () => {
  async function newLead() {
    const { user: agent } = await createUser({ role: UserRole.AGENT });
    const created = await request(app).post('/api/leads').set('Cookie', authCookieFor(agent)).send({});
    return { agent, leadId: created.body.lead._id as string };
  }

  function uploadOther(agent: Parameters<typeof authCookieFor>[0], leadId: string, fields: Record<string, string>) {
    let req = request(app).post(`/api/leads/${leadId}/documents`).set('Cookie', authCookieFor(agent)).field('documentType', 'Other Document');
    for (const [k, v] of Object.entries(fields)) req = req.field(k, v);
    return attachImage(req);
  }

  it('adds each named Other Document as its own document', async () => {
    const { agent, leadId } = await newLead();

    const first = await uploadOther(agent, leadId, { customName: 'Ration Card' });
    const second = await uploadOther(agent, leadId, { customName: 'Property Tax Bill' });

    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(first.body.document.customName).toBe('Ration Card');
    expect(second.body.document.customName).toBe('Property Tax Bill');
    expect(first.body.document._id).not.toBe(second.body.document._id);

    const lead = await request(app).get(`/api/leads/${leadId}`).set('Cookie', authCookieFor(agent));
    expect(lead.body.lead.documents.filter((d: { documentType: string }) => d.documentType === 'Other Document')).toHaveLength(2);
  });

  it('requires a name for a new Other Document', async () => {
    const { agent, leadId } = await newLead();
    const res = await uploadOther(agent, leadId, {});
    expect(res.status).toBe(400);
  });

  it('adds a page to the targeted Other Document only', async () => {
    const { agent, leadId } = await newLead();
    const first = await uploadOther(agent, leadId, { customName: 'Ration Card' });
    const second = await uploadOther(agent, leadId, { customName: 'Gas Bill' });

    const appended = await uploadOther(agent, leadId, { documentId: first.body.document._id, mode: 'append' });

    expect(appended.status).toBe(201);
    expect(appended.body.document._id).toBe(first.body.document._id);
    expect(appended.body.document.pages).toHaveLength(2);
    const lead = await request(app).get(`/api/leads/${leadId}`).set('Cookie', authCookieFor(agent));
    const gas = lead.body.lead.documents.find((d: { _id: string }) => d._id === second.body.document._id);
    expect(gas.pages).toHaveLength(1);
  });

  it('caps the number of Other Documents', async () => {
    const { agent, leadId } = await newLead();
    for (let i = 1; i <= 5; i++) {
      await uploadOther(agent, leadId, { customName: `Doc ${i}` }).expect(201);
    }
    const sixth = await uploadOther(agent, leadId, { customName: 'Doc 6' });
    expect(sixth.status).toBe(400);
  });

  it('renames an Other Document, but not a standard document type', async () => {
    const { agent, leadId } = await newLead();
    const other = await uploadOther(agent, leadId, { customName: 'Ration Crd' });
    const aadhaar = await attachImage(
      request(app).post(`/api/leads/${leadId}/documents`).set('Cookie', authCookieFor(agent)).field('documentType', 'Aadhaar Card'),
    );

    const renamed = await request(app)
      .patch(`/api/documents/${other.body.document._id}`)
      .set('Cookie', authCookieFor(agent))
      .send({ customName: 'Ration Card' });
    expect(renamed.status).toBe(200);
    expect(renamed.body.document.customName).toBe('Ration Card');

    const blank = await request(app)
      .patch(`/api/documents/${other.body.document._id}`)
      .set('Cookie', authCookieFor(agent))
      .send({ customName: '   ' });
    expect(blank.status).toBe(400);

    const standard = await request(app)
      .patch(`/api/documents/${aadhaar.body.document._id}`)
      .set('Cookie', authCookieFor(agent))
      .send({ customName: 'Something' });
    expect(standard.status).toBe(400);
  });
});
