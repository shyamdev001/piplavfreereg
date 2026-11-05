import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../src/app';
import { createUser, authCookieFor } from './helpers';
import { UserRole } from '../src/types/enums';
import { Lead } from '../src/models/Lead';
import { generateLeadId } from '../src/utils/generateLeadId';

async function createLeadFor(userId: string) {
  const leadId = await generateLeadId();
  return Lead.create({
    leadId,
    createdBy: userId,
    isDraft: false,
    customerBasicDetails: {
      fullName: 'Owner Only Customer',
      mobileNumber: '9123456780',
      customerType: 'Residential',
    },
  });
}

describe('Lead authorization', () => {
  it('prevents an agent from accessing another agent\'s lead', async () => {
    const { user: ownerAgent } = await createUser({ role: UserRole.AGENT });
    const { user: otherAgent } = await createUser({ role: UserRole.AGENT });
    const lead = await createLeadFor(String(ownerAgent._id));

    const res = await request(app)
      .get(`/api/leads/${lead._id}`)
      .set('Cookie', authCookieFor(otherAgent));

    expect(res.status).toBe(403);
  });

  it('allows an agent to access their own lead', async () => {
    const { user: agent } = await createUser({ role: UserRole.AGENT });
    const lead = await createLeadFor(String(agent._id));

    const res = await request(app).get(`/api/leads/${lead._id}`).set('Cookie', authCookieFor(agent));

    expect(res.status).toBe(200);
    expect(res.body.lead.leadId).toBe(lead.leadId);
  });

  it('allows an admin to access any lead', async () => {
    const { user: agent } = await createUser({ role: UserRole.AGENT });
    const { user: admin } = await createUser({ role: UserRole.ADMIN });
    const lead = await createLeadFor(String(agent._id));

    const res = await request(app).get(`/api/leads/${lead._id}`).set('Cookie', authCookieFor(admin));

    expect(res.status).toBe(200);
  });

  it('excludes other agents\' leads from an agent\'s list view', async () => {
    const { user: agentA } = await createUser({ role: UserRole.AGENT });
    const { user: agentB } = await createUser({ role: UserRole.AGENT });
    await createLeadFor(String(agentA._id));
    await createLeadFor(String(agentB._id));

    const res = await request(app).get('/api/leads').set('Cookie', authCookieFor(agentB));

    expect(res.status).toBe(200);
    expect(res.body.leads).toHaveLength(1);
    expect(res.body.leads[0].createdBy._id).toBe(String(agentB._id));
  });

  it('blocks an agent from admin-only agent-management routes', async () => {
    const { user: agent } = await createUser({ role: UserRole.AGENT });

    const res = await request(app).get('/api/agents').set('Cookie', authCookieFor(agent));

    expect(res.status).toBe(403);
  });

  it('blocks an agent from changing lead status (admin-only)', async () => {
    const { user: agent } = await createUser({ role: UserRole.AGENT });
    const lead = await createLeadFor(String(agent._id));

    const res = await request(app)
      .patch(`/api/leads/${lead._id}/status`)
      .set('Cookie', authCookieFor(agent))
      .send({ status: 'CONTACTED' });

    expect(res.status).toBe(403);
  });

  it('rejects unauthenticated requests to protected routes', async () => {
    const res = await request(app).get('/api/leads');
    expect(res.status).toBe(401);
  });
});

describe('Viewer role (read-only)', () => {
  it('can list, open and export every registration and see dashboard stats', async () => {
    const { user: agent } = await createUser({ role: UserRole.AGENT });
    const { user: viewer } = await createUser({ role: UserRole.VIEWER });
    const lead = await createLeadFor(String(agent._id));
    const cookie = authCookieFor(viewer);

    const list = await request(app).get('/api/leads').set('Cookie', cookie);
    expect(list.status).toBe(200);
    expect(list.body.leads).toHaveLength(1);

    expect((await request(app).get(`/api/leads/${lead._id}`).set('Cookie', cookie)).status).toBe(200);
    expect((await request(app).get(`/api/leads/${lead._id}/documents`).set('Cookie', cookie)).status).toBe(200);
    expect((await request(app).get('/api/leads/export').set('Cookie', cookie)).status).toBe(200);
    expect((await request(app).get('/api/dashboard/stats').set('Cookie', cookie)).status).toBe(200);
    expect((await request(app).get('/api/agents').set('Cookie', cookie)).status).toBe(200);
  });

  it('cannot change anything', async () => {
    const { user: agent } = await createUser({ role: UserRole.AGENT });
    const { user: viewer } = await createUser({ role: UserRole.VIEWER });
    const lead = await createLeadFor(String(agent._id));
    const cookie = authCookieFor(viewer);

    const attempts = [
      request(app).post('/api/leads').set('Cookie', cookie).send({}),
      request(app).patch(`/api/leads/${lead._id}`).set('Cookie', cookie).send({ notes: 'x' }),
      request(app).post(`/api/leads/${lead._id}/submit`).set('Cookie', cookie),
      request(app).delete(`/api/leads/${lead._id}`).set('Cookie', cookie),
      request(app).patch(`/api/leads/${lead._id}/status`).set('Cookie', cookie).send({ status: 'CONTACTED' }),
      request(app).post(`/api/leads/${lead._id}/archive`).set('Cookie', cookie),
      request(app).post(`/api/leads/${lead._id}/documents`).set('Cookie', cookie),
      request(app).delete('/api/documents/507f1f77bcf86cd799439011').set('Cookie', cookie),
      request(app).patch('/api/documents/507f1f77bcf86cd799439011').set('Cookie', cookie).send({ customName: 'x' }),
      request(app).post('/api/agents').set('Cookie', cookie).send({}),
      request(app).get('/api/audit-logs').set('Cookie', cookie),
    ];
    for (const res of await Promise.all(attempts)) expect(res.status).toBe(403);
  });

  it('can be created by an admin from the team page', async () => {
    const { user: admin } = await createUser({ role: UserRole.ADMIN });

    const res = await request(app)
      .post('/api/agents')
      .set('Cookie', authCookieFor(admin))
      .send({ name: 'Village Viewer', email: 'viewer@piplav.test', phone: '9876543210', password: 'ViewPass123', role: 'VIEWER' });

    expect(res.status).toBe(201);
    expect(res.body.agent.role).toBe('VIEWER');
    const list = await request(app).get('/api/agents').set('Cookie', authCookieFor(admin));
    expect(list.body.agents.some((a: { role: string }) => a.role === 'VIEWER')).toBe(true);
  });
});

describe('Editing submitted registrations', () => {
  it('lets an agent edit their own submitted registration', async () => {
    const { user: agent } = await createUser({ role: UserRole.AGENT });
    const lead = await createLeadFor(String(agent._id));

    const res = await request(app)
      .patch(`/api/leads/${lead._id}`)
      .set('Cookie', authCookieFor(agent))
      .send({ notes: 'Corrected consumer number' });

    expect(res.status).toBe(200);
    expect(res.body.lead.notes).toBe('Corrected consumer number');
  });

  it('lets an admin edit any registration but not another agent', async () => {
    const { user: owner } = await createUser({ role: UserRole.AGENT });
    const { user: other } = await createUser({ role: UserRole.AGENT });
    const { user: admin } = await createUser({ role: UserRole.ADMIN });
    const lead = await createLeadFor(String(owner._id));

    const asAdmin = await request(app).patch(`/api/leads/${lead._id}`).set('Cookie', authCookieFor(admin)).send({ notes: 'Admin fix' });
    expect(asAdmin.status).toBe(200);
    const asOther = await request(app).patch(`/api/leads/${lead._id}`).set('Cookie', authCookieFor(other)).send({ notes: 'nope' });
    expect(asOther.status).toBe(403);
  });
});
