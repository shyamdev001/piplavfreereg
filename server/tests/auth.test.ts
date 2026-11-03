import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app } from '../src/app';
import { createUser } from './helpers';
import { UserRole, UserStatus } from '../src/types/enums';

describe('POST /api/auth/login', () => {
  it('logs in with valid credentials and sets auth cookies', async () => {
    const { user, password } = await createUser({ email: 'valid@test.dev', password: 'ValidPass1!' });

    const res = await request(app).post('/api/auth/login').send({ email: user.email, password });

    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe(user.email);
    expect(res.body.user).not.toHaveProperty('passwordHash');
    const cookies = res.headers['set-cookie'] as unknown as string[];
    expect(cookies.some((c) => c.startsWith('accessToken='))).toBe(true);
    expect(cookies.some((c) => c.startsWith('refreshToken='))).toBe(true);
  });

  it('rejects an invalid password', async () => {
    const { user } = await createUser({ email: 'wrongpass@test.dev', password: 'ValidPass1!' });

    const res = await request(app).post('/api/auth/login').send({ email: user.email, password: 'WrongPass1!' });

    expect(res.status).toBe(401);
  });

  it('rejects login for a non-existent email', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'nobody@test.dev', password: 'whatever1' });
    expect(res.status).toBe(401);
  });

  it('rejects login for a disabled agent', async () => {
    const { user, password } = await createUser({
      email: 'disabled@test.dev',
      password: 'ValidPass1!',
      role: UserRole.AGENT,
      status: UserStatus.DISABLED,
    });

    const res = await request(app).post('/api/auth/login').send({ email: user.email, password });

    expect(res.status).toBe(403);
  });

  it('rejects malformed request bodies', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'not-an-email', password: '' });
    expect(res.status).toBe(400);
  });
});

describe('GET /api/auth/me', () => {
  it('rejects requests without a valid session', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });
});
