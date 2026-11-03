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
