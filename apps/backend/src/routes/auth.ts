import type { FastifyInstance } from 'fastify';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { createHash } from 'crypto';
import appleSignin from 'apple-signin-auth';
import { getDb } from '../db/client.js';
import type {
  RegisterRequest,
  LoginRequest,
  AppleSignInRequest,
  RefreshRequest,
  AuthResponse,
} from '@receipt-scanner/shared';

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function generateTokenPair(fastify: FastifyInstance, userId: string) {
  const accessToken = fastify.jwt.sign({ userId }, { expiresIn: '15m' });
  const refreshToken = uuidv4();
  const expiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000; // 30 days
  const db = getDb();
  db.prepare(
    'INSERT INTO refresh_tokens (id, user_id, token_hash, expires_at) VALUES (?, ?, ?, ?)',
  ).run(uuidv4(), userId, hashToken(refreshToken), expiresAt);
  return { accessToken, refreshToken };
}

export async function authRoutes(fastify: FastifyInstance) {
  // POST /auth/register
  fastify.post<{ Body: RegisterRequest }>(
    '/register',
    {
      config: { rateLimit: { max: 5, timeWindow: '1 minute' } },
    },
    async (request, reply) => {
      const { email, password } = request.body;
      const db = getDb();
      const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
      if (existing) return reply.status(409).send({ error: 'Email already registered' });

      const id = uuidv4();
      const passwordHash = await bcrypt.hash(password, 12);
      db.prepare(
        'INSERT INTO users (id, email, password_hash, created_at) VALUES (?, ?, ?, ?)',
      ).run(id, email, passwordHash, Date.now());

      const { accessToken, refreshToken } = generateTokenPair(fastify, id);
      const response: AuthResponse = {
        accessToken,
        refreshToken,
        user: { id, email },
      };
      return reply.status(201).send(response);
    },
  );

  // POST /auth/login
  fastify.post<{ Body: LoginRequest }>(
    '/login',
    {
      config: { rateLimit: { max: 5, timeWindow: '1 minute' } },
    },
    async (request, reply) => {
      const { email, password } = request.body;
      const db = getDb();
      const user = db
        .prepare('SELECT id, email, password_hash FROM users WHERE email = ?')
        .get(email) as { id: string; email: string; password_hash: string } | undefined;
      if (!user) return reply.status(401).send({ error: 'Invalid credentials' });

      const valid = await bcrypt.compare(password, user.password_hash);
      if (!valid) return reply.status(401).send({ error: 'Invalid credentials' });

      const { accessToken, refreshToken } = generateTokenPair(fastify, user.id);
      const response: AuthResponse = {
        accessToken,
        refreshToken,
        user: { id: user.id, email: user.email },
      };
      return response;
    },
  );

  // POST /auth/apple
  fastify.post<{ Body: AppleSignInRequest }>(
    '/apple',
    {
      config: { rateLimit: { max: 5, timeWindow: '1 minute' } },
    },
    async (request, reply) => {
      const { identityToken, email } = request.body;
      let applePayload: { sub: string };
      try {
        applePayload = (await appleSignin.verifyIdToken(identityToken, {
          audience: process.env.APPLE_CLIENT_ID ?? 'com.yourapp.receiptscanner',
          ignoreExpiration: false,
        })) as { sub: string };
      } catch {
        return reply.status(401).send({ error: 'Invalid Apple token' });
      }

      const db = getDb();
      const appleId = applePayload.sub;
      let user = db.prepare('SELECT id, email FROM users WHERE apple_id = ?').get(appleId) as
        | { id: string; email: string | null }
        | undefined;

      if (!user) {
        const id = uuidv4();
        const resolvedEmail = email ?? null;
        db.prepare(
          'INSERT INTO users (id, email, apple_id, created_at) VALUES (?, ?, ?, ?)',
        ).run(id, resolvedEmail, appleId, Date.now());
        user = { id, email: resolvedEmail };
      }

      const { accessToken, refreshToken } = generateTokenPair(fastify, user.id);
      const response: AuthResponse = {
        accessToken,
        refreshToken,
        user: { id: user.id, email: user.email },
      };
      return response;
    },
  );

  // POST /auth/refresh
  fastify.post<{ Body: RefreshRequest }>(
    '/refresh',
    {
      config: { rateLimit: { max: 5, timeWindow: '1 minute' } },
    },
    async (request, reply) => {
      const { refreshToken } = request.body;
      const db = getDb();
      const tokenHash = hashToken(refreshToken);
      const stored = db
        .prepare('SELECT id, user_id, expires_at FROM refresh_tokens WHERE token_hash = ?')
        .get(tokenHash) as { id: string; user_id: string; expires_at: number } | undefined;

      if (!stored || stored.expires_at < Date.now()) {
        return reply.status(401).send({ error: 'Invalid or expired refresh token' });
      }

      const accessToken = fastify.jwt.sign({ userId: stored.user_id }, { expiresIn: '15m' });
      return { accessToken };
    },
  );

  // DELETE /auth/logout
  fastify.delete(
    '/logout',
    { preHandler: [fastify.authenticate] },
    async (request, reply) => {
      const { userId } = request.user;
      const db = getDb();
      db.prepare('DELETE FROM refresh_tokens WHERE user_id = ?').run(userId);
      return reply.status(204).send();
    },
  );
}
