import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../src/app';
import { createUser, authCookieFor } from './helpers';
import { UserRole } from '../src/types/enums';

const customer = { customerName: 'Jayeshbhai Patel', address: 'Station Road, Petlad', mobileNumber: '9898989898' };

async function cookieFor(role: UserRole) {
  const { user } = await createUser({ role });
  return authCookieFor(user);
}

const post = (cookie: string, body: object) =>
  request(app).post('/api/quotations').set('Cookie', cookie).send({ ...customer, ...body });

describe('KDCC Employee quotations (2.18 kW, General only)', () => {
  it('prices General at 97,290 with add-ons on top, and refuses other categories', async () => {
    const cookie = await cookieFor(UserRole.QUOTATION);
    const res = await post(cookie, { village: 'KDCC', category: 'GENERAL' });
    expect(res.status).toBe(201);
    expect(res.body.quotation.village).toBe('KDCC');
    expect(res.body.quotation.kind).toBe('STANDARD');
    expect(res.body.quotation.amount).toBe(97290);

    const admin = await cookieFor(UserRole.ADMIN);
    const policy = await request(app).post('/api/quotations/extras').set('Cookie', admin).send({ name: 'Policy', price: 700 });
    const withPolicy = await post(cookie, { village: 'KDCC', category: 'GENERAL', extras: [{ id: policy.body.extra._id, price: 700 }] });
    expect(withPolicy.body.quotation.amount).toBe(97990);

    expect((await post(cookie, { village: 'KDCC', category: 'SC_ST' })).status).toBe(400);
    expect((await post(cookie, { village: 'KDCC', category: 'PASHUPALAK' })).status).toBe(400);

    const pdf = await request(app).get(`/api/quotations/${res.body.quotation._id}/pdf`).set('Cookie', cookie);
    expect(pdf.status).toBe(200);
  });

  it('lets staff make them with the policy tick', async () => {
    const cookie = await cookieFor(UserRole.QUOTATION_STAFF);
    const ticked = await post(cookie, { village: 'KDCC', category: 'GENERAL' });
    expect(ticked.status).toBe(201);
    expect(ticked.body.quotation.kind).toBe('STAFF');
    expect(ticked.body.quotation.village).toBe('KDCC');
    expect(ticked.body.quotation.amount).toBe(97990);
    const unticked = await post(cookie, { village: 'KDCC', category: 'GENERAL', policyIncluded: false });
    expect(unticked.body.quotation.amount).toBe(97290);
    expect((await post(cookie, { village: 'KDCC', category: 'SC_ST' })).status).toBe(400);
    // Staff still can't make Piplav ones; Other village is still the default.
    expect((await post(cookie, { village: 'PIPLAV', category: 'GENERAL' })).status).toBe(403);
    expect((await post(cookie, { category: 'GENERAL' })).body.quotation.village).toBe('OTHER');

    // Editing keeps the KDCC price.
    const edited = await request(app)
      .patch(`/api/quotations/${unticked.body.quotation._id}`)
      .set('Cookie', cookie)
      .send({ policyIncluded: true });
    expect(edited.status).toBe(200);
    expect(edited.body.quotation.amount).toBe(97990);
  });

  it('is not open to viewers', async () => {
    const cookie = await cookieFor(UserRole.VIEWER);
    expect((await post(cookie, { village: 'KDCC', category: 'GENERAL' })).status).toBe(403);
  });
});
