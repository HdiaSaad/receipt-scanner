import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildServer } from '../src/index.js';
import { initDb, closeDb } from '../src/db/client.js';
import type { FastifyInstance } from 'fastify';

let server: FastifyInstance;

beforeAll(async () => {
  process.env.JWT_SECRET = 'test-secret-32-chars-minimum-len';
  initDb(':memory:');
  server = buildServer();
  await server.ready();
});

afterAll(async () => {
  await server.close();
  closeDb();
});

describe('POST /auth/register', () => {
  it('creates a user and returns tokens', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { email: 'test@example.com', password: 'password123' },
    });
    expect(res.statusCode).toBe(201);
    const body = res.json();
    expect(body.accessToken).toBeDefined();
    expect(body.refreshToken).toBeDefined();
    expect(body.user.email).toBe('test@example.com');
  });

  it('returns 409 for duplicate email', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/auth/register',
      payload: { email: 'test@example.com', password: 'password123' },
    });
    expect(res.statusCode).toBe(409);
  });
});

describe('POST /auth/login', () => {
  it('returns tokens for valid credentials', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: 'test@example.com', password: 'password123' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().accessToken).toBeDefined();
  });

  it('returns 401 for wrong password', async () => {
    const res = await server.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: 'test@example.com', password: 'wrong' },
    });
    expect(res.statusCode).toBe(401);
  });
});

describe('POST /auth/refresh', () => {
  it('issues new access token', async () => {
    const login = await server.inject({
      method: 'POST',
      url: '/auth/login',
      payload: { email: 'test@example.com', password: 'password123' },
    });
    const { refreshToken } = login.json();
    const res = await server.inject({
      method: 'POST',
      url: '/auth/refresh',
      payload: { refreshToken },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().accessToken).toBeDefined();
  });
});
