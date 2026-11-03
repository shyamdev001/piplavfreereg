import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../src/app';
import { createUser, authCookieFor } from './helpers';
import { UserRole } from '../src/types/enums';

describe('Lead creation & drafts', () => {
  it('creates a draft lead with an auto-generated sequential leadId', async () => {
    const { user: agent } = await createUser({ role: UserRole.AGENT });

    const res1 = await request(app).post('/api/leads').set('Cookie', authCookieFor(agent)).send({});
    const res2 = await request(app).post('/api/leads').set('Cookie', authCookieFor(agent)).send({});

    expect(res1.status).toBe(201);
    expect(res2.status).toBe(201);
    expect(res1.body.lead.leadId).toMatch(/^SOL-\d{6}$/);
    expect(res1.body.lead.isDraft).toBe(true);
    expect(res1.body.lead.leadId).not.toBe(res2.body.lead.leadId);
  });

  it('pre-fills Piplav village defaults on a new draft', async () => {
    const { user: agent } = await createUser({ role: UserRole.AGENT });
    const res = await request(app).post('/api/leads').set('Cookie', authCookieFor(agent)).send({});

    expect(res.body.lead.customerBasicDetails.customerType).toBe('Residential');
    expect(res.body.lead.customerAddress).toMatchObject({
      cityVillage: 'Piplav',
      district: 'Anand',
      state: 'Gujarat',
      pincode: '388460',
    });
    expect(res.body.lead.solarInformation.requiredSystemSizeKw).toBe(2.18);
  });

  it('requires electricity consumer name and number before submission', async () => {
    const { user: agent } = await createUser({ role: UserRole.AGENT });
    const created = await request(app).post('/api/leads').set('Cookie', authCookieFor(agent)).send({});
    const leadId = created.body.lead._id;

    await request(app)
      .patch(`/api/leads/${leadId}`)
      .set('Cookie', authCookieFor(agent))
      .send({ customerBasicDetails: { fullName: 'No Consumer', mobileNumber: '9812345111' }, customerAddress: { fullAddress: '12 Main Road' } })
      .expect(200);

    const res = await request(app).post(`/api/leads/${leadId}/submit`).set('Cookie', authCookieFor(agent));
    expect(res.status).toBe(400);
  });

  it('saves progressive draft data across multiple PATCH calls without losing prior sections', async () => {
    const { user: agent } = await createUser({ role: UserRole.AGENT });
    const created = await request(app).post('/api/leads').set('Cookie', authCookieFor(agent)).send({});
    const leadId = created.body.lead._id;

    await request(app)
      .patch(`/api/leads/${leadId}`)
      .set('Cookie', authCookieFor(agent))
      .send({ customerBasicDetails: { fullName: 'Test Customer', mobileNumber: '9812345678', customerType: 'Residential' } })
      .expect(200);

    const afterAddress = await request(app)
      .patch(`/api/leads/${leadId}`)
      .set('Cookie', authCookieFor(agent))
      .send({ customerAddress: { fullAddress: '123 Test St', cityVillage: 'Pune', district: 'Pune', state: 'MH', pincode: '411001' } })
      .expect(200);

    expect(afterAddress.body.lead.customerBasicDetails.fullName).toBe('Test Customer');
    expect(afterAddress.body.lead.customerAddress.cityVillage).toBe('Pune');
  });

  it('rejects submission when required fields are incomplete', async () => {
    const { user: agent } = await createUser({ role: UserRole.AGENT });
    const created = await request(app).post('/api/leads').set('Cookie', authCookieFor(agent)).send({});
    const leadId = created.body.lead._id;

    const res = await request(app).post(`/api/leads/${leadId}/submit`).set('Cookie', authCookieFor(agent));

    expect(res.status).toBe(400);
  });

  it('submits successfully once all required fields are present', async () => {
    const { user: agent } = await createUser({ role: UserRole.AGENT });
    const created = await request(app).post('/api/leads').set('Cookie', authCookieFor(agent)).send({});
    const leadId = created.body.lead._id;

    await request(app)
      .patch(`/api/leads/${leadId}`)
      .set('Cookie', authCookieFor(agent))
      .send({
        customerBasicDetails: { fullName: 'Complete Customer', mobileNumber: '9812345678', customerType: 'Residential' },
        customerAddress: { fullAddress: '123 Test St', cityVillage: 'Pune', district: 'Pune', state: 'MH', pincode: '411001' },
        electricityDetails: { consumerName: 'Complete Customer', consumerNumber: '12345' },
      })
      .expect(200);

    const res = await request(app).post(`/api/leads/${leadId}/submit`).set('Cookie', authCookieFor(agent));

    expect(res.status).toBe(200);
    expect(res.body.lead.isDraft).toBe(false);
  });

  it('flags a possible duplicate by mobile number', async () => {
    const { user: agent } = await createUser({ role: UserRole.AGENT });
    const created = await request(app).post('/api/leads').set('Cookie', authCookieFor(agent)).send({});
    await request(app)
      .patch(`/api/leads/${created.body.lead._id}`)
      .set('Cookie', authCookieFor(agent))
      .send({
        customerBasicDetails: { fullName: 'Dup Customer', mobileNumber: '9999999999', customerType: 'Residential' },
        customerAddress: { fullAddress: '123 Sample Street', cityVillage: 'Pune', district: 'Pune', state: 'MH', pincode: '411001' },
        electricityDetails: { consumerName: 'Dup Customer', consumerNumber: '12345' },
      })
      .expect(200);
    await request(app).post(`/api/leads/${created.body.lead._id}/submit`).set('Cookie', authCookieFor(agent)).expect(200);

    const res = await request(app)
      .get('/api/leads/duplicates')
      .query({ mobileNumber: '9999999999' })
      .set('Cookie', authCookieFor(agent));

    expect(res.status).toBe(200);
    expect(res.body.hasDuplicates).toBe(true);
    expect(res.body.duplicates.length).toBeGreaterThan(0);
  });
});

describe('Optional numeric fields', () => {
  it('leaves an optional numeric field unset when submitted as an empty string (regression)', async () => {
    const { user: agent } = await createUser({ role: UserRole.AGENT });
    const created = await request(app).post('/api/leads').set('Cookie', authCookieFor(agent)).send({});

    const res = await request(app)
      .patch(`/api/leads/${created.body.lead._id}`)
      .set('Cookie', authCookieFor(agent))
      .send({ solarInformation: { requiredSystemSizeKw: '' }, electricityDetails: { consumerNumber: '12345' } });

    expect(res.status).toBe(200);
    expect(res.body.lead.solarInformation?.requiredSystemSizeKw).toBeUndefined();
    expect(res.body.lead.electricityDetails.consumerNumber).toBe('12345');
  });
});

describe('Lead listing query params', () => {
  it('does not treat archived=false as truthy (regression)', async () => {
    const { user: agent } = await createUser({ role: UserRole.AGENT });
    const created = await request(app).post('/api/leads').set('Cookie', authCookieFor(agent)).send({});
    await request(app)
      .patch(`/api/leads/${created.body.lead._id}`)
      .set('Cookie', authCookieFor(agent))
      .send({
        customerBasicDetails: { fullName: 'Visible Customer', mobileNumber: '9812345000', customerType: 'Residential' },
        customerAddress: { fullAddress: '123 Test Street', cityVillage: 'Pune', district: 'Pune', state: 'MH', pincode: '411001' },
        electricityDetails: { consumerName: 'Visible Customer', consumerNumber: '12345' },
      })
      .expect(200);
    await request(app).post(`/api/leads/${created.body.lead._id}/submit`).set('Cookie', authCookieFor(agent)).expect(200);

    const res = await request(app).get('/api/leads?archived=false').set('Cookie', authCookieFor(agent));

    expect(res.status).toBe(200);
    expect(res.body.leads.length).toBe(1);
  });
});

describe('Admin lead status & archiving', () => {
  it('lets an admin change lead status and records the transition', async () => {
    const { user: agent } = await createUser({ role: UserRole.AGENT });
    const { user: admin } = await createUser({ role: UserRole.ADMIN });
    const created = await request(app).post('/api/leads').set('Cookie', authCookieFor(agent)).send({});
    const leadId = created.body.lead._id;

    const res = await request(app)
      .patch(`/api/leads/${leadId}/status`)
      .set('Cookie', authCookieFor(admin))
      .send({ status: 'CONTACTED' });

    expect(res.status).toBe(200);
    expect(res.body.lead.status).toBe('CONTACTED');
  });

  it('rejects an invalid status value', async () => {
    const { user: agent } = await createUser({ role: UserRole.AGENT });
    const { user: admin } = await createUser({ role: UserRole.ADMIN });
    const created = await request(app).post('/api/leads').set('Cookie', authCookieFor(agent)).send({});

    const res = await request(app)
      .patch(`/api/leads/${created.body.lead._id}/status`)
      .set('Cookie', authCookieFor(admin))
      .send({ status: 'NOT_A_REAL_STATUS' });

    expect(res.status).toBe(400);
  });

  it('archives and restores a lead', async () => {
    const { user: agent } = await createUser({ role: UserRole.AGENT });
    const { user: admin } = await createUser({ role: UserRole.ADMIN });
    const created = await request(app).post('/api/leads').set('Cookie', authCookieFor(agent)).send({});
    const leadId = created.body.lead._id;

    const archived = await request(app).post(`/api/leads/${leadId}/archive`).set('Cookie', authCookieFor(admin));
    expect(archived.status).toBe(200);
    expect(archived.body.lead.archived).toBe(true);

    const restored = await request(app).post(`/api/leads/${leadId}/restore`).set('Cookie', authCookieFor(admin));
    expect(restored.status).toBe(200);
    expect(restored.body.lead.archived).toBe(false);
  });
});
