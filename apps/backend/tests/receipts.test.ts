import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildServer } from '../src/index.js';
import { initDb, closeDb, getDb } from '../src/db/client.js';
import { v4 as uuidv4 } from 'uuid';
import bcrypt from 'bcryptjs';
import type { FastifyInstance } from 'fastify';

let server: FastifyInstance;
let accessToken: string;

beforeAll(async () => {
  process.env.JWT_SECRET = 'test-secret-32-chars-minimum-len';
  initDb(':memory:');
  server = buildServer();
  await server.ready();

  // Seed a user
  const db = getDb();
  const userId = uuidv4();
  db.prepare('INSERT INTO users (id, email, password_hash, created_at) VALUES (?, ?, ?, ?)')
    .run(userId, 'receipts@test.com', await bcrypt.hash('pass123', 1), Date.now());

  const login = await server.inject({
    method: 'POST', url: '/auth/login',
    payload: { email: 'receipts@test.com', password: 'pass123' },
  });
  accessToken = login.json().accessToken;
});

afterAll(async () => {
  await server.close();
  closeDb();
});

function authHeader() {
  return { Authorization: `Bearer ${accessToken}` };
}

describe('POST /receipts', () => {
  it('creates a receipt and returns it', async () => {
    const res = await server.inject({
      method: 'POST', url: '/receipts',
      headers: authHeader(),
      payload: {
        store: 'Carrefour', date: '2026-09-15', total: 25.50,
        currency: 'EUR', tax: 1.20, imageUrl: 'https://cdn.example.com/img.jpg',
        rawOcr: '{}', lineItems: [],
      },
    });
    expect(res.statusCode).toBe(201);
    const receipt = res.json();
    expect(receipt.id).toBeDefined();
    expect(receipt.store).toBe('Carrefour');
  });
});

describe('GET /receipts', () => {
  it('returns paginated list for authenticated user', async () => {
    const res = await server.inject({
      method: 'GET', url: '/receipts?page=1&limit=10',
      headers: authHeader(),
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(Array.isArray(body.receipts)).toBe(true);
    expect(body.page).toBe(1);
  });
});

describe('GET /receipts/stats', () => {
  it('returns stats object', async () => {
    const res = await server.inject({
      method: 'GET', url: '/receipts/stats',
      headers: authHeader(),
    });
    expect(res.statusCode).toBe(200);
    const stats = res.json();
    expect(typeof stats.totalThisMonth).toBe('number');
    expect(Array.isArray(stats.weeklyTotals)).toBe(true);
    expect(Array.isArray(stats.topStores)).toBe(true);
  });
});

describe('GET /receipts/:id', () => {
  it('returns a specific receipt', async () => {
    // Create a receipt first
    const createRes = await server.inject({
      method: 'POST', url: '/receipts',
      headers: authHeader(),
      payload: {
        store: 'Aldi', date: '2026-09-10', total: 12.00,
        currency: 'EUR', tax: 0.50, imageUrl: 'https://cdn.example.com/aldi.jpg',
        rawOcr: '{}', lineItems: [],
      },
    });
    const { id } = createRes.json();

    const res = await server.inject({
      method: 'GET', url: `/receipts/${id}`,
      headers: authHeader(),
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().store).toBe('Aldi');
  });

  it('returns 404 for unknown id', async () => {
    const res = await server.inject({
      method: 'GET', url: '/receipts/nonexistent-id',
      headers: authHeader(),
    });
    expect(res.statusCode).toBe(404);
  });
});

describe('PUT /receipts/:id', () => {
  it('updates a receipt', async () => {
    const createRes = await server.inject({
      method: 'POST', url: '/receipts',
      headers: authHeader(),
      payload: {
        store: 'Lidl', date: '2026-09-05', total: 8.00,
        currency: 'EUR', tax: 0.30, imageUrl: 'https://cdn.example.com/lidl.jpg',
        rawOcr: '{}', lineItems: [],
      },
    });
    const { id } = createRes.json();

    const res = await server.inject({
      method: 'PUT', url: `/receipts/${id}`,
      headers: authHeader(),
      payload: { total: 9.99 },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().total).toBe(9.99);
  });
});

describe('DELETE /receipts/:id', () => {
  it('deletes a receipt', async () => {
    const createRes = await server.inject({
      method: 'POST', url: '/receipts',
      headers: authHeader(),
      payload: {
        store: 'Monoprix', date: '2026-09-01', total: 5.00,
        currency: 'EUR', tax: 0.10, imageUrl: 'https://cdn.example.com/mono.jpg',
        rawOcr: '{}', lineItems: [],
      },
    });
    const { id } = createRes.json();

    const delRes = await server.inject({
      method: 'DELETE', url: `/receipts/${id}`,
      headers: authHeader(),
    });
    expect(delRes.statusCode).toBe(204);

    const getRes = await server.inject({
      method: 'GET', url: `/receipts/${id}`,
      headers: authHeader(),
    });
    expect(getRes.statusCode).toBe(404);
  });
});

describe('Auth guard', () => {
  it('returns 401 without token', async () => {
    const res = await server.inject({ method: 'GET', url: '/receipts' });
    expect(res.statusCode).toBe(401);
  });
});
