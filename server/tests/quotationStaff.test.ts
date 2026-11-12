import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../src/app';
import { createUser, authCookieFor } from './helpers';
import { UserRole } from '../src/types/enums';

const customer = { customerName: 'Rameshbhai Patel', address: 'Main Road, Sunav, Petlad', mobileNumber: '9876543210' };

async function staffCookie() {
  const { user } = await createUser({ role: UserRole.QUOTATION_STAFF });
  return { user, cookie: authCookieFor(user) };
}

describe('Staff quotations (Other village, policy tick)', () => {
  it('adds the 700 policy on top by default', async () => {
    const { cookie } = await staffCookie();
    const res = await request(app).post('/api/quotations').set('Cookie', cookie).send({ ...customer, category: 'GENERAL' });
    expect(res.status).toBe(201);
    const q = res.body.quotation;
    expect(q.kind).toBe('STAFF');
    expect(q.village).toBe('OTHER');
    expect(q.policyIncluded).toBe(true);
    expect(q.systemPrice).toBe(110000);
    expect(q.extras).toEqual([{ name: 'Policy', price: 700, includedInPrice: false }]);
    expect(q.amount).toBe(110700);
  });

  it('leaves the 700 out of the total when the policy is unticked', async () => {
    const { cookie } = await staffCookie();
    const general = await request(app).post('/api/quotations').set('Cookie', cookie).send({ ...customer, category: 'GENERAL', policyIncluded: false });
    expect(general.body.quotation.amount).toBe(110000);
    expect(general.body.quotation.extras).toEqual([]);
    expect(general.body.quotation.policyIncluded).toBe(false);

    const pashu = await request(app).post('/api/quotations').set('Cookie', cookie).send({ ...customer, category: 'PASHUPALAK', policyIncluded: false });
    expect(pashu.body.quotation.amount).toBe(108000);

    const pdf = await request(app).get(`/api/quotations/${general.body.quotation._id}/pdf`).set('Cookie', cookie).buffer(true);
    expect(pdf.status).toBe(200);
  });

  it('keeps staff to Other village, General/Pashupalak, no add-ons, own quotations only', async () => {
    const { cookie } = await staffCookie();
    const { cookie: other } = await staffCookie();
    const post = (body: object) => request(app).post('/api/quotations').set('Cookie', cookie).send({ ...customer, ...body });

    expect((await post({ village: 'PIPLAV', category: 'GENERAL' })).status).toBe(403);
    expect((await post({ category: 'SC_ST' })).status).toBe(400);
    expect((await post({ category: 'GENERAL', extras: [{ id: '507f1f77bcf86cd799439011', price: 10 }] })).status).toBe(400);
    const mine = await post({ village: 'OTHER', category: 'GENERAL' });
    expect(mine.status).toBe(201);

    expect((await request(app).get('/api/quotations').set('Cookie', other)).body.quotations).toHaveLength(0);
    expect((await request(app).get(`/api/quotations/${mine.body.quotation._id}/pdf`).set('Cookie', other)).status).toBe(404);
    expect((await request(app).get('/api/quotations/extras').set('Cookie', cookie)).status).toBe(403);
    expect((await request(app).get('/api/quotations/history').set('Cookie', cookie)).status).toBe(403);
    expect((await request(app).get('/api/leads').set('Cookie', cookie)).status).toBe(403);
    expect((await request(app).delete(`/api/quotations/${mine.body.quotation._id}`).set('Cookie', cookie)).status).toBe(403);
  });

  it('keeps the main quotation user (Mukt) on the village form, without the staff tick', async () => {
    const { user } = await createUser({ role: UserRole.QUOTATION });
    const cookie = authCookieFor(user);
    const piplav = await request(app).post('/api/quotations').set('Cookie', cookie).send({ ...customer, category: 'SC_ST' });
    expect(piplav.status).toBe(201);
    expect(piplav.body.quotation.village).toBe('PIPLAV');
    expect(piplav.body.quotation.kind).toBe('STANDARD');
    expect(piplav.body.quotation.amount).toBe(102695);
    // The staff policy tick has no effect on the main form.
    const other = await request(app).post('/api/quotations').set('Cookie', cookie).send({ ...customer, village: 'OTHER', category: 'GENERAL', policyIncluded: false });
    expect(other.body.quotation.amount).toBe(110000);
    expect(other.body.quotation.extras).toEqual([]);
    expect(other.body.quotation.policyIncluded).toBeUndefined();
  });

  it('never gives two quotations the same number, even when saved at once', async () => {
    const people = await Promise.all(Array.from({ length: 5 }, () => staffCookie()));
    const results = await Promise.all(
      Array.from({ length: 25 }, (_, i) =>
        request(app).post('/api/quotations').set('Cookie', people[i % 5].cookie).send({ ...customer, category: 'GENERAL' }),
      ),
    );
    expect(results.every((r) => r.status === 201)).toBe(true);
    const numbers = results.map((r) => r.body.quotation.quotationNumber);
    expect(new Set(numbers).size).toBe(25);
  });

  it('lets an admin create staff accounts', async () => {
    const { user: admin } = await createUser({ role: UserRole.ADMIN });
    const res = await request(app)
      .post('/api/agents')
      .set('Cookie', authCookieFor(admin))
      .send({ name: 'Staff One', email: 'staff1@piplav.test', phone: '9876500003', password: 'StaffPass123', role: 'QUOTATION_STAFF' });
    expect(res.status).toBe(201);
    expect(res.body.agent.role).toBe('QUOTATION_STAFF');
  });
});

describe('Editing quotations', () => {
  it('lets staff edit their own quotation; price is recalculated and the change is logged', async () => {
    const { cookie } = await staffCookie();
    const created = await request(app).post('/api/quotations').set('Cookie', cookie).send({ ...customer, category: 'GENERAL' });
    const id = created.body.quotation._id;

    const edited = await request(app)
      .patch(`/api/quotations/${id}`)
      .set('Cookie', cookie)
      .send({ mobileNumber: '9123456780', policyIncluded: false, amount: 1 });
    expect(edited.status).toBe(200);
    expect(edited.body.quotation.mobileNumber).toBe('9123456780');
    expect(edited.body.quotation.amount).toBe(110000);
    expect(edited.body.quotation.quotationNumber).toBe(created.body.quotation.quotationNumber);

    const { user: admin } = await createUser({ role: UserRole.ADMIN });
    const history = await request(app).get(`/api/quotations/history?targetId=${id}&action=QUOTATION_UPDATED`).set('Cookie', authCookieFor(admin));
    expect(history.body.logs).toHaveLength(1);
    expect(history.body.logs[0].details).toContain('Mobile: 9876543210 -> 9123456780');
    expect(history.body.logs[0].details).toContain('Policy: Included -> Not included');
    expect(history.body.logs[0].details).toContain('Total: Rs 1,10,700.00 -> Rs 1,10,000.00');
  });

  it('blocks editing other people’s quotations and the policy tick on main-form quotations', async () => {
    const { cookie } = await staffCookie();
    const { cookie: other } = await staffCookie();
    const { user: viewer } = await createUser({ role: UserRole.VIEWER });
    const { user: mukt } = await createUser({ role: UserRole.QUOTATION });
    const { user: admin } = await createUser({ role: UserRole.ADMIN });
    const staffQ = await request(app).post('/api/quotations').set('Cookie', cookie).send({ ...customer, category: 'GENERAL' });
    const muktQ = await request(app).post('/api/quotations').set('Cookie', authCookieFor(mukt)).send({ ...customer, village: 'OTHER', category: 'GENERAL' });

    expect((await request(app).patch(`/api/quotations/${staffQ.body.quotation._id}`).set('Cookie', other).send({ customerName: 'Hacker' })).status).toBe(404);
    expect((await request(app).patch(`/api/quotations/${staffQ.body.quotation._id}`).set('Cookie', authCookieFor(viewer)).send({ customerName: 'X Y' })).status).toBe(403);
    expect((await request(app).patch(`/api/quotations/${muktQ.body.quotation._id}`).set('Cookie', authCookieFor(mukt)).send({ policyIncluded: false })).status).toBe(400);

    // Admin can edit anyone's; changing category reprices.
    const byAdmin = await request(app).patch(`/api/quotations/${muktQ.body.quotation._id}`).set('Cookie', authCookieFor(admin)).send({ category: 'PASHUPALAK' });
    expect(byAdmin.status).toBe(200);
    expect(byAdmin.body.quotation.amount).toBe(108000);
    expect(byAdmin.body.quotation.updatedByName).toBeTruthy();
  });
});

describe('Quotation history', () => {
  it('shows who did what and when, with filters and a CSV export', async () => {
    const { user: s1, cookie: c1 } = await staffCookie();
    const { cookie: c2 } = await staffCookie();
    const { user: admin } = await createUser({ role: UserRole.ADMIN });
    const { user: viewer } = await createUser({ role: UserRole.VIEWER });
    const { user: mukt } = await createUser({ role: UserRole.QUOTATION });
    const q1 = await request(app).post('/api/quotations').set('Cookie', c1).send({ ...customer, category: 'GENERAL' });
    await request(app).post('/api/quotations').set('Cookie', c2).send({ ...customer, customerName: 'Sureshbhai Shah', category: 'PASHUPALAK' });
    await request(app).get(`/api/quotations/${q1.body.quotation._id}/pdf`).set('Cookie', c1);

    const adminCookie = authCookieFor(admin);
    const all = await request(app).get('/api/quotations/history').set('Cookie', adminCookie);
    expect(all.status).toBe(200);
    expect(all.body.logs).toHaveLength(3);
    expect(all.body.logs[0].action).toBe('QUOTATION_DOWNLOADED'); // newest first

    const bys1 = await request(app).get(`/api/quotations/history?actorId=${s1._id}&action=QUOTATION_CREATED`).set('Cookie', adminCookie);
    expect(bys1.body.logs).toHaveLength(1);
    expect(bys1.body.logs[0].details).toContain('General');

    const search = await request(app).get('/api/quotations/history?search=suresh').set('Cookie', adminCookie);
    expect(search.body.logs).toHaveLength(1);

    const future = await request(app).get('/api/quotations/history?from=2999-01-01').set('Cookie', adminCookie);
    expect(future.body.logs).toHaveLength(0);

    const csv = await request(app).get('/api/quotations/history/export').set('Cookie', authCookieFor(viewer));
    expect(csv.status).toBe(200);
    expect(csv.headers['content-type']).toContain('text/csv');
    expect(csv.text).toContain('"Date & time (IST)","User","Role","Action","Quotation","Details"');
    expect(csv.text).toContain('Sureshbhai Shah');

    expect((await request(app).get('/api/quotations/history').set('Cookie', authCookieFor(mukt))).status).toBe(403);

    // Admins can narrow the quotation list to one staff member.
    const list = await request(app).get(`/api/quotations?createdBy=${s1._id}`).set('Cookie', adminCookie);
    expect(list.body.quotations).toHaveLength(1);
  });
});
