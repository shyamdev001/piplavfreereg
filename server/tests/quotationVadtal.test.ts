import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../src/app';
import { createUser, authCookieFor } from './helpers';
import { UserRole } from '../src/types/enums';

const customer = { customerName: 'Mahendrabhai Patel', address: 'Mandir Road, Vadtal', mobileNumber: '9825012345' };

async function cookieFor(role: UserRole) {
  const { user } = await createUser({ role });
  return authCookieFor(user);
}

const post = (cookie: string, body: object) =>
  request(app).post('/api/quotations').set('Cookie', cookie).send({ ...customer, ...body });

describe('Vadtal Employee quotations (2.18 kW, General only)', () => {
  it('prices General at 1,08,000 and refuses other categories', async () => {
    const cookie = await cookieFor(UserRole.QUOTATION);
    const res = await post(cookie, { village: 'VADTAL', category: 'GENERAL' });
    expect(res.status).toBe(201);
    expect(res.body.quotation.village).toBe('VADTAL');
    expect(res.body.quotation.amount).toBe(108000);
    expect((await post(cookie, { village: 'VADTAL', category: 'SC_ST' })).status).toBe(400);
    const pdf = await request(app).get(`/api/quotations/${res.body.quotation._id}/pdf`).set('Cookie', cookie);
    expect(pdf.status).toBe(200);
  });

  it('lets staff make them with the policy tick, but not viewers', async () => {
    const staff = await cookieFor(UserRole.QUOTATION_STAFF);
    const ticked = await post(staff, { village: 'VADTAL', category: 'GENERAL' });
    expect(ticked.status).toBe(201);
    expect(ticked.body.quotation.amount).toBe(108700);
    expect((await post(staff, { village: 'VADTAL', category: 'GENERAL', policyIncluded: false })).body.quotation.amount).toBe(108000);
    expect((await post(await cookieFor(UserRole.VIEWER), { village: 'VADTAL', category: 'GENERAL' })).status).toBe(403);
  });
});
