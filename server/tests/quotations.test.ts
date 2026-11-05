import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../src/app';
import { createUser, authCookieFor } from './helpers';
import { UserRole } from '../src/types/enums';
import { rupeesInWords, formatIndianAmount } from '../src/utils/amountInWords';

const customer = { customerName: 'Hiteshbhai Patel', address: 'Near Ram Mandir, Piplav, Anand', mobileNumber: '9876543210' };

describe('Quotations', () => {
  it('prices by category and numbers quotations per day', async () => {
    const { user } = await createUser({ role: UserRole.QUOTATION });
    const cookie = authCookieFor(user);

    const general = await request(app).post('/api/quotations').set('Cookie', cookie).send({ ...customer, category: 'GENERAL' });
    expect(general.status).toBe(201);
    expect(general.body.quotation.amount).toBe(97290);
    expect(general.body.quotation.systemSizeKw).toBe(2.18);
    expect(general.body.quotation.quotationNumber).toMatch(/^PROP-\d{8}-0001$/);

    const scst = await request(app).post('/api/quotations').set('Cookie', cookie).send({ ...customer, category: 'SC_ST', amount: 1 });
    expect(scst.status).toBe(201);
    expect(scst.body.quotation.amount).toBe(102695); // client-sent amount is ignored
    expect(scst.body.quotation.quotationNumber).toMatch(/-0002$/);
  });

  it('returns a PDF download', async () => {
    const { user } = await createUser({ role: UserRole.QUOTATION });
    const cookie = authCookieFor(user);
    const created = await request(app).post('/api/quotations').set('Cookie', cookie).send({ ...customer, category: 'GENERAL' });

    const pdf = await request(app).get(`/api/quotations/${created.body.quotation._id}/pdf`).set('Cookie', cookie).buffer(true);
    expect(pdf.status).toBe(200);
    expect(pdf.headers['content-type']).toBe('application/pdf');
    expect(pdf.headers['content-disposition']).toContain('attachment; filename="Quotation-PROP-');
    expect(Buffer.from(pdf.body).subarray(0, 5).toString()).toBe('%PDF-');
  });

  it('rejects non-English text and bad mobile numbers', async () => {
    const { user } = await createUser({ role: UserRole.QUOTATION });
    const res = await request(app)
      .post('/api/quotations')
      .set('Cookie', authCookieFor(user))
      .send({ customerName: 'હિતેશ', address: 'Piplav', mobileNumber: '123', category: 'GENERAL' });
    expect(res.status).toBe(400);
  });

  it('keeps each quotation user to their own quotations; admin and viewer see all', async () => {
    const { user: q1 } = await createUser({ role: UserRole.QUOTATION });
    const { user: q2 } = await createUser({ role: UserRole.QUOTATION });
    const { user: admin } = await createUser({ role: UserRole.ADMIN });
    const { user: viewer } = await createUser({ role: UserRole.VIEWER });
    const mine = await request(app).post('/api/quotations').set('Cookie', authCookieFor(q1)).send({ ...customer, category: 'GENERAL' });
    await request(app).post('/api/quotations').set('Cookie', authCookieFor(q2)).send({ ...customer, category: 'SC_ST' });

    expect((await request(app).get('/api/quotations').set('Cookie', authCookieFor(q1))).body.quotations).toHaveLength(1);
    expect((await request(app).get(`/api/quotations/${mine.body.quotation._id}/pdf`).set('Cookie', authCookieFor(q2))).status).toBe(404);
    expect((await request(app).get('/api/quotations').set('Cookie', authCookieFor(admin))).body.quotations).toHaveLength(2);
    expect((await request(app).get('/api/quotations').set('Cookie', authCookieFor(viewer))).body.quotations).toHaveLength(2);
    expect((await request(app).post('/api/quotations').set('Cookie', authCookieFor(viewer)).send({ ...customer, category: 'GENERAL' })).status).toBe(403);
    expect((await request(app).delete(`/api/quotations/${mine.body.quotation._id}`).set('Cookie', authCookieFor(q1))).status).toBe(403);
    expect((await request(app).delete(`/api/quotations/${mine.body.quotation._id}`).set('Cookie', authCookieFor(admin))).status).toBe(200);
  });

  it('blocks quotation users from registrations, documents and agents', async () => {
    const { user } = await createUser({ role: UserRole.QUOTATION });
    const cookie = authCookieFor(user);
    expect((await request(app).get('/api/leads').set('Cookie', cookie)).status).toBe(403);
    expect((await request(app).post('/api/leads').set('Cookie', cookie).send({})).status).toBe(403);
    expect((await request(app).get('/api/documents/507f1f77bcf86cd799439011/access').set('Cookie', cookie)).status).toBe(403);
    expect((await request(app).get('/api/agents').set('Cookie', cookie)).status).toBe(403);
    expect((await request(app).get('/api/dashboard/stats').set('Cookie', cookie)).status).toBe(403);
  });

  it('lets an admin create a quotation user', async () => {
    const { user: admin } = await createUser({ role: UserRole.ADMIN });
    const res = await request(app)
      .post('/api/agents')
      .set('Cookie', authCookieFor(admin))
      .send({ name: 'Quote Desk', email: 'quotes@piplav.test', phone: '9876500002', password: 'QuotePass123', role: 'QUOTATION' });
    expect(res.status).toBe(201);
    expect(res.body.agent.role).toBe('QUOTATION');
  });
});

describe('Amount in words', () => {
  it('uses Indian numbering', () => {
    expect(rupeesInWords(97290)).toBe('Indian Rupee Ninety-seven Thousand Two Hundred Ninety Only');
    expect(rupeesInWords(102695)).toBe('Indian Rupee One Lakh Two Thousand Six Hundred Ninety-five Only');
    expect(rupeesInWords(168700)).toBe('Indian Rupee One Lakh Sixty-eight Thousand Seven Hundred Only');
    expect(formatIndianAmount(102695)).toBe('1,02,695.00');
  });
});
