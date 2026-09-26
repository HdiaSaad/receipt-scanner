import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildServer } from '../src/index.js';
import { initDb, closeDb } from '../src/db/client.js';
import type { FastifyInstance } from 'fastify';

let server: FastifyInstance;
let accessToken: string;

beforeAll(async () => {
  process.env.JWT_SECRET = 'test-secret-32-chars-minimum-len';
  initDb(':memory:');
  server = buildServer();
  await server.ready();

  await server.inject({
    method: 'POST', url: '/auth/register',
    payload: { email: 'user@test.com', password: 'pass123' },
  });
  const login = await server.inject({
    method: 'POST', url: '/auth/login',
    payload: { email: 'user@test.com', password: 'pass123' },
  });
  accessToken = login.json().accessToken;
});

afterAll(async () => { await server.close(); closeDb(); });

describe('GET /users/me', () => {
  it('returns user profile', async () => {
    const res = await server.inject({
      method: 'GET', url: '/users/me',
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().email).toBe('user@test.com');
  });
});

describe('PUT /users/me', () => {
  it('updates user email and returns updated profile', async () => {
    const res = await server.inject({
      method: 'PUT', url: '/users/me',
      headers: { Authorization: `Bearer ${accessToken}` },
      payload: { email: 'newemail@test.com' },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().email).toBe('newemail@test.com');
  });

  it('requires authorization', async () => {
    const res = await server.inject({
      method: 'GET', url: '/users/me',
    });
    expect(res.statusCode).toBe(401);
  });
});
