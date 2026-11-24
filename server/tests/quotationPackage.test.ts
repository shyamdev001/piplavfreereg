import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../src/app';
import { createUser, authCookieFor } from './helpers';
import { UserRole } from '../src/types/enums';

const customer = { customerName: 'Ghanshyambhai Valand', address: 'Bhavanipura, Petlad', mobileNumber: '9724634420' };

async function cookieFor(role: UserRole) {
  const { user } = await createUser({ role });
  return { user, cookie: authCookieFor(user) };
}

const make = (cookie: string, body: object) =>
  request(app).post('/api/quotations/package').set('Cookie', cookie).send({ ...customer, ...body });

describe('Package quotations (APS / Adani / Waaree, 6-10 panels)', () => {
  it('prices each company and size, with insurance 3000 and dongle 1700 on top by default', async () => {
    const { cookie } = await cookieFor(UserRole.QUOTATION);
    const waaree = await make(cookie, { brand: 'WAAREE', panelCount: 8 });
    expect(waaree.status).toBe(201);
    const q = waaree.body.quotation;
    expect(q.kind).toBe('PACKAGE');
    expect(q.systemSizeKw).toBe(4.32);
    expect(q.systemPrice).toBe(212000);
    expect(q.amount).toBe(216700); // same as the sample quotation
    expect(q.category).toBeUndefined();
    expect(q.extras.map((e: { name: string; price: number }) => [e.name, e.price])).toEqual([
      ['INSURANCE', 3000],
      ['WIFI DONGLE', 1700],
    ]);

    const expected: Array<[string, number, number, number]> = [
      ['APS', 6, 3.3, 162000],
      ['APS', 10, 5.5, 260000],
      ['ADANI', 7, 3.78, 198000],
      ['ADANI', 10, 5.4, 280000],
      ['WAAREE', 6, 3.24, 164000],
      ['WAAREE', 9, 4.86, 238700],
      ['WAAREE', 10, 5.4, 265600],
    ];
    for (const [brand, panelCount, kw, price] of expected) {
      const res = await make(cookie, { brand, panelCount });
      expect(res.body.quotation.systemSizeKw).toBe(kw);
      expect(res.body.quotation.amount).toBe(price + 4700);
    }
  });

  it('makes Adani 3.24 kW Rs 1,70,700 in full', async () => {
    const { cookie } = await cookieFor(UserRole.QUOTATION);
    const res = await make(cookie, { brand: 'ADANI', panelCount: 6 });
    expect(res.body.quotation.systemSizeKw).toBe(3.24);
    expect(res.body.quotation.amount).toBe(170700);
  });

  it('always includes insurance and dongle - they cannot be left out', async () => {
    const { cookie } = await cookieFor(UserRole.QUOTATION_STAFF);
    const res = await make(cookie, { brand: 'ADANI', panelCount: 6, insuranceIncluded: false, dongleIncluded: false });
    expect(res.status).toBe(201);
    expect(res.body.quotation.amount).toBe(170700);
    expect(res.body.quotation.extras).toHaveLength(2);
    const pdf = await request(app).get(`/api/quotations/${res.body.quotation._id}/pdf`).set('Cookie', cookie).buffer(true);
    expect(pdf.status).toBe(200);
    expect(pdf.headers['content-type']).toContain('application/pdf');
  });

  it('lets every quotation role make them, and refuses bad sizes', async () => {
    for (const role of [UserRole.ADMIN, UserRole.QUOTATION, UserRole.QUOTATION_STAFF, UserRole.VIEWER]) {
      const { cookie } = await cookieFor(role);
      expect((await make(cookie, { brand: 'APS', panelCount: 7 })).status).toBe(201);
    }
    const { cookie: agent } = await cookieFor(UserRole.AGENT);
    expect((await make(agent, { brand: 'APS', panelCount: 7 })).status).toBe(403);
    const { cookie } = await cookieFor(UserRole.QUOTATION);
    expect((await make(cookie, { brand: 'APS', panelCount: 11 })).status).toBe(400);
    expect((await make(cookie, { brand: 'TATA', panelCount: 7 })).status).toBe(400);
  });

  it('can be edited (size, company) and logs the change; category does not apply', async () => {
    const { cookie } = await cookieFor(UserRole.QUOTATION_STAFF);
    const created = await make(cookie, { brand: 'WAAREE', panelCount: 8 });
    const id = created.body.quotation._id;

    const edited = await request(app)
      .patch(`/api/quotations/${id}`)
      .set('Cookie', cookie)
      .send({ brand: 'ADANI', panelCount: 6 });
    expect(edited.status).toBe(200);
    expect(edited.body.quotation.amount).toBe(170700);
    expect(edited.body.quotation.systemSizeKw).toBe(3.24);
    expect(edited.body.quotation.quotationNumber).toBe(created.body.quotation.quotationNumber);
    expect((await request(app).patch(`/api/quotations/${id}`).set('Cookie', cookie).send({ category: 'GENERAL' })).status).toBe(400);

    const { cookie: admin } = await cookieFor(UserRole.ADMIN);
    const history = await request(app).get(`/api/quotations/history?targetId=${id}`).set('Cookie', admin);
    const details = history.body.logs.map((l: { details?: string }) => l.details).join(' | ');
    expect(details).toContain('4.32 kW WAAREE Mono Bifacial 540W');
    expect(details).toContain('System: 4.32 kW WAAREE Mono Bifacial 540W -> 3.24 kW ADANI Mono Bifacial 540W');
    expect(details).toContain('Total: Rs 2,16,700.00 -> Rs 1,70,700.00');
  });

  it('offers two panel types per company (Mono Bifacial and TOPCon)', async () => {
    const { cookie } = await cookieFor(UserRole.QUOTATION);
    const cases: Array<[string, string, number, number, number]> = [
      ['ADANI', 'MONO_540', 6, 3.24, 166000],
      ['ADANI', 'TOPCON_610', 6, 3.66, 184000],
      ['WAAREE', 'MONO_540', 8, 4.32, 212000],
      ['WAAREE', 'TOPCON_580', 8, 4.64, 235000],
      ['APS', 'TOPCON_550', 7, 3.85, 182000],
      ['APS', 'TOPCON_600', 10, 6, 265000],
    ];
    for (const [brand, panelType, panelCount, kw, price] of cases) {
      const res = await make(cookie, { brand, panelType, panelCount });
      expect(res.status).toBe(201);
      expect(res.body.quotation.panelType).toBe(panelType);
      expect(res.body.quotation.systemSizeKw).toBe(kw);
      expect(res.body.quotation.amount).toBe(price + 4700);
    }
    // Left out = the company's first type; a type the company doesn't sell is refused.
    expect((await make(cookie, { brand: 'ADANI', panelCount: 6 })).body.quotation.panelType).toBe('MONO_540');
    expect((await make(cookie, { brand: 'APS', panelType: 'MONO_540', panelCount: 6 })).status).toBe(400);
    expect((await make(cookie, { brand: 'ADANI', panelType: 'TOPCON_580', panelCount: 6 })).status).toBe(400);

    const created = await make(cookie, { brand: 'ADANI', panelType: 'TOPCON_610', panelCount: 6 });
    const pdf = await request(app).get(`/api/quotations/${created.body.quotation._id}/pdf`).set('Cookie', cookie);
    expect(pdf.status).toBe(200);
  });

  it('switches panel type on edit, and a new company falls back to its default type', async () => {
    const { cookie } = await cookieFor(UserRole.QUOTATION_STAFF);
    const id = (await make(cookie, { brand: 'ADANI', panelType: 'MONO_540', panelCount: 6 })).body.quotation._id;
    const patch = (body: object) => request(app).patch(`/api/quotations/${id}`).set('Cookie', cookie).send(body);

    const topcon = await patch({ panelType: 'TOPCON_610' });
    expect(topcon.status).toBe(200);
    expect(topcon.body.quotation.amount).toBe(188700);
    expect(topcon.body.quotation.systemSizeKw).toBe(3.66);

    const waaree = await patch({ brand: 'WAAREE' });
    expect(waaree.body.quotation.panelType).toBe('MONO_540');
    expect(waaree.body.quotation.amount).toBe(168700);
    expect((await patch({ panelType: 'TOPCON_600' })).status).toBe(400);

    const { cookie: admin } = await cookieFor(UserRole.ADMIN);
    const history = await request(app).get(`/api/quotations/history?targetId=${id}`).set('Cookie', admin);
    const details = history.body.logs.map((l: { details?: string }) => l.details).join(' | ');
    expect(details).toContain('System: 3.24 kW ADANI Mono Bifacial 540W -> 3.66 kW ADANI TOPCon 610W');
  });

  it('filters the list into 2.18 kW and bigger systems', async () => {
    const { cookie } = await cookieFor(UserRole.QUOTATION);
    await make(cookie, { brand: 'APS', panelCount: 7 });
    await request(app).post('/api/quotations').set('Cookie', cookie).send({ ...customer, category: 'GENERAL' });
    const list = (system?: string) =>
      request(app).get('/api/quotations').query(system ? { system } : {}).set('Cookie', cookie);
    expect((await list()).body.quotations).toHaveLength(2);
    const big = (await list('PACKAGE')).body.quotations;
    expect(big.map((q: { kind: string }) => q.kind)).toEqual(['PACKAGE']);
    const small = (await list('SMALL')).body.quotations;
    expect(small).toHaveLength(1);
    expect(small[0].systemSizeKw).toBe(2.18);
    expect((await list('HUGE')).status).toBe(400);
  });

  it('keeps package fields off the 2.18 kW quotations', async () => {
    const { cookie } = await cookieFor(UserRole.QUOTATION);
    const q = await request(app).post('/api/quotations').set('Cookie', cookie).send({ ...customer, category: 'GENERAL' });
    expect(q.body.quotation.amount).toBe(97290);
    expect((await request(app).patch(`/api/quotations/${q.body.quotation._id}`).set('Cookie', cookie).send({ panelCount: 8 })).status).toBe(400);
  });
});
