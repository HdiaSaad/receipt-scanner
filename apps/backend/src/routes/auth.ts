import type { FastifyInstance } from 'fastify';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { createHash } from 'crypto';
import appleSignin from 'apple-signin-auth';
import { z } from 'zod';
import { getDb } from '../db/client.js';
import type {
  AuthResponse,
} from '@receipt-scanner/shared';

// --- Zod schemas ---
const RegisterSchema = z.object({ email: z.string().email(), password: z.string().min(8) });
const LoginSchema = z.object({ email: z.string().email(), password: z.string().min(1) });
const AppleSchema = z.object({
  identityToken: z.string(),
  email: z.string().email().nullable().optional(),
  givenName: z.string().nullable().optional(),
  familyName: z.string().nullable().optional(),
});
const RefreshSchema = z.object({ refreshToken: z.string() });

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
  fastify.post(
    '/register',
    {
      config: { rateLimit: { max: 5, timeWindow: '1 minute' } },
    },
    async (request, reply) => {
      const parsed = RegisterSchema.safeParse(request.body);
      if (!parsed.success) return reply.status(400).send({ error: 'Invalid input' });
      const { email, password } = parsed.data;

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
  fastify.post(
    '/login',
    {
      config: { rateLimit: { max: 5, timeWindow: '1 minute' } },
    },
    async (request, reply) => {
      const parsed = LoginSchema.safeParse(request.body);
      if (!parsed.success) return reply.status(400).send({ error: 'Invalid input' });
      const { email, password } = parsed.data;

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
  fastify.post(
    '/apple',
    {
      config: { rateLimit: { max: 5, timeWindow: '1 minute' } },
    },
    async (request, reply) => {
      const parsed = AppleSchema.safeParse(request.body);
      if (!parsed.success) return reply.status(400).send({ error: 'Invalid input' });
      const { identityToken, email } = parsed.data;

      const clientId = process.env.APPLE_CLIENT_ID;
      if (!clientId) return reply.status(503).send({ error: 'Apple Sign In not configured' });

      let applePayload: { sub: string };
      try {
        applePayload = (await appleSignin.verifyIdToken(identityToken, {
          audience: clientId,
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
  fastify.post(
    '/refresh',
    {
      config: { rateLimit: { max: 5, timeWindow: '1 minute' } },
    },
    async (request, reply) => {
      const parsed = RefreshSchema.safeParse(request.body);
      if (!parsed.success) return reply.status(400).send({ error: 'Invalid input' });
      const { refreshToken } = parsed.data;

      const db = getDb();
      const tokenHash = hashToken(refreshToken);
      const stored = db
        .prepare('SELECT id, user_id, expires_at FROM refresh_tokens WHERE token_hash = ?')
        .get(tokenHash) as { id: string; user_id: string; expires_at: number } | undefined;

      if (!stored || stored.expires_at < Date.now()) {
        return reply.status(401).send({ error: 'Invalid or expired refresh token' });
      }

      // Delete old token (rotation)
      db.prepare('DELETE FROM refresh_tokens WHERE token_hash = ?').run(tokenHash);

      // Issue new access + refresh pair
      const { accessToken, refreshToken: newRefreshToken } = generateTokenPair(fastify, stored.user_id);
      return { accessToken, refreshToken: newRefreshToken };
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
