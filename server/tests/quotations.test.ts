import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../src/app';
import { Quotation } from '../src/models/Quotation';
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
    expect(scst.body.quotation.village).toBe('PIPLAV'); // default
  });

  it('uses the other-village prices and only allows that village categories', async () => {
    const { user } = await createUser({ role: UserRole.QUOTATION });
    const cookie = authCookieFor(user);
    const post = (body: object) => request(app).post('/api/quotations').set('Cookie', cookie).send({ ...customer, ...body });

    const general = await post({ village: 'OTHER', category: 'GENERAL' });
    expect(general.status).toBe(201);
    expect(general.body.quotation.amount).toBe(110000);
    expect(general.body.quotation.village).toBe('OTHER');
    expect((await post({ village: 'OTHER', category: 'PASHUPALAK' })).body.quotation.amount).toBe(108000);
    expect((await post({ village: 'PIPLAV', category: 'GENERAL' })).body.quotation.amount).toBe(97290);

    expect((await post({ village: 'OTHER', category: 'SC_ST' })).status).toBe(400);
    expect((await post({ village: 'PIPLAV', category: 'PASHUPALAK' })).status).toBe(400);
    expect((await post({ village: 'ANAND', category: 'GENERAL' })).status).toBe(400);

    const pdf = await request(app).get(`/api/quotations/${general.body.quotation._id}/pdf?inline=1`).set('Cookie', cookie).buffer(true);
    expect(pdf.status).toBe(200);
    expect(pdf.headers['content-disposition']).toContain('inline;');
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

  it('adds ticked add-ons to the total; only admins manage the add-on list', async () => {
    const { user: admin } = await createUser({ role: UserRole.ADMIN });
    const { user: quoter } = await createUser({ role: UserRole.QUOTATION });
    const adminCookie = authCookieFor(admin);
    const cookie = authCookieFor(quoter);

    const insurance = await request(app).post('/api/quotations/extras').set('Cookie', adminCookie).send({ name: 'Insurance', description: '5 years', price: 1500 });
    expect(insurance.status).toBe(201);
    const dongle = await request(app).post('/api/quotations/extras').set('Cookie', adminCookie).send({ name: 'WiFi Dongle', price: 2000 });
    const retired = await request(app).post('/api/quotations/extras').set('Cookie', adminCookie).send({ name: 'Old item', price: 99, active: false });
    expect((await request(app).post('/api/quotations/extras').set('Cookie', cookie).send({ name: 'Hack', price: 0 })).status).toBe(403);

    const offered = await request(app).get('/api/quotations/extras').set('Cookie', cookie);
    expect(offered.body.extras.map((e: { name: string }) => e.name)).toEqual(['Insurance', 'WiFi Dongle']);
    expect((await request(app).get('/api/quotations/extras').set('Cookie', adminCookie)).body.extras).toHaveLength(3);

    const ids = [insurance.body.extra._id, dongle.body.extra._id];
    const q = await request(app).post('/api/quotations').set('Cookie', cookie).send({ ...customer, category: 'GENERAL', extras: [{ id: ids[0], price: 1500 }, { id: ids[1], price: 2000 }] });
    expect(q.status).toBe(201);
    expect(q.body.quotation.basePrice).toBe(97290);
    expect(q.body.quotation.systemPrice).toBe(97290);
    expect(q.body.quotation.amount).toBe(97290 + 1500 + 2000); // add-ons go on top
    expect(q.body.quotation.extras).toEqual([
      { name: 'Insurance', description: '5 years', price: 1500, includedInPrice: false },
      { name: 'WiFi Dongle', price: 2000, includedInPrice: false },
    ]);

    // Inactive or unknown add-ons are refused.
    expect((await request(app).post('/api/quotations').set('Cookie', cookie).send({ ...customer, category: 'GENERAL', extras: [{ id: retired.body.extra._id, price: 99 }] })).status).toBe(400);
    expect((await request(app).post('/api/quotations').set('Cookie', cookie).send({ ...customer, category: 'GENERAL', extras: [{ id: '507f1f77bcf86cd799439011', price: 10 }] })).status).toBe(400);

    // Changing or deleting an add-on later leaves the saved quotation alone.
    await request(app).patch(`/api/quotations/extras/${insurance.body.extra._id}`).set('Cookie', adminCookie).send({ price: 9999 });
    await request(app).delete(`/api/quotations/extras/${dongle.body.extra._id}`).set('Cookie', adminCookie);
    const list = await request(app).get('/api/quotations').set('Cookie', cookie);
    expect(list.body.quotations[0].amount).toBe(100790);

    const pdf = await request(app).get(`/api/quotations/${q.body.quotation._id}/pdf`).set('Cookie', cookie).buffer(true);
    expect(pdf.status).toBe(200);
    expect((await request(app).patch('/api/quotations/extras/not-an-id').set('Cookie', adminCookie).send({ price: 1 })).status).toBe(400);
  });

  it('adds the typed policy amount on top of panels + inverter', async () => {
    const { user: admin } = await createUser({ role: UserRole.ADMIN });
    const { user: quoter } = await createUser({ role: UserRole.QUOTATION });
    const add = (body: object) => request(app).post('/api/quotations/extras').set('Cookie', authCookieFor(admin)).send(body);
    const policy = await add({ name: 'Policy', price: 700 });
    const huge = await add({ name: 'Huge', price: 200000 });

    const cookie = authCookieFor(quoter);
    const q = await request(app)
      .post('/api/quotations')
      .set('Cookie', cookie)
      .send({ ...customer, village: 'OTHER', category: 'GENERAL', extras: [{ id: policy.body.extra._id, price: 700 }] });
    expect(q.status).toBe(201);
    expect(q.body.quotation.systemPrice).toBe(110000);
    expect(q.body.quotation.extras[0].price).toBe(700);
    expect(q.body.quotation.amount).toBe(110700);

    // No policy: just panels + inverter.
    const none = await request(app).post('/api/quotations').set('Cookie', cookie).send({ ...customer, village: 'OTHER', category: 'GENERAL' });
    expect(none.body.quotation.amount).toBe(110000);

    // The policy amount differs per customer: whatever is typed is added.
    const q2 = await request(app)
      .post('/api/quotations')
      .set('Cookie', cookie)
      .send({ ...customer, village: 'OTHER', category: 'GENERAL', extras: [{ id: policy.body.extra._id, price: 1250 }] });
    expect(q2.body.quotation.extras[0].price).toBe(1250);
    expect(q2.body.quotation.systemPrice).toBe(110000);
    expect(q2.body.quotation.amount).toBe(111250);
    const zero = await request(app)
      .post('/api/quotations')
      .set('Cookie', cookie)
      .send({ ...customer, category: 'GENERAL', extras: [{ id: policy.body.extra._id, price: 0 }] });
    expect(zero.status).toBe(400);

    const big = await request(app).post('/api/quotations').set('Cookie', cookie).send({ ...customer, category: 'GENERAL', extras: [{ id: huge.body.extra._id, price: 200000 }] });
    expect(big.body.quotation.amount).toBe(97290 + 200000);
  });

  it('keeps the old total when editing a quotation saved under the fixed-total rule', async () => {
    const { user: quoter } = await createUser({ role: UserRole.QUOTATION });
    const old = await Quotation.create({
      quotationNumber: 'PROP-20261101-0001',
      ...customer,
      village: 'OTHER',
      category: 'GENERAL',
      basePrice: 110700,
      systemPrice: 110000,
      extras: [{ name: 'Policy', price: 700, includedInPrice: true }],
      amount: 110700,
      systemSizeKw: 2.18,
      quotationDate: new Date(),
      expiryDate: new Date(),
      createdBy: quoter._id,
      createdByName: quoter.name,
    });
    const edited = await request(app).patch(`/api/quotations/${old._id}`).set('Cookie', authCookieFor(quoter)).send({ customerName: 'Renamed Person' });
    expect(edited.status).toBe(200);
    expect(edited.body.quotation.amount).toBe(110700);
    expect(edited.body.quotation.systemPrice).toBe(110000);
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
