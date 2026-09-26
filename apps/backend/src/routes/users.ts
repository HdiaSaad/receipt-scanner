import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { getDb } from '../db/client.js';
import type { UserProfile } from '@receipt-scanner/shared';

// --- Zod schemas ---
const UpdateUserSchema = z.object({ email: z.string().email().optional() });

export async function usersRoutes(fastify: FastifyInstance) {
  fastify.addHook('preHandler', fastify.authenticate);

  fastify.get('/me', async (request, reply) => {
    const { userId } = request.user;
    const db = getDb();
    const user = db.prepare('SELECT id, email FROM users WHERE id = ?').get(userId) as
      { id: string; email: string | null } | undefined;
    if (!user) return reply.status(404).send({ error: 'User not found' });
    const profile: UserProfile = { id: user.id, email: user.email };
    return profile;
  });

  fastify.put('/me', async (request, reply) => {
    const parsed = UpdateUserSchema.safeParse(request.body);
    if (!parsed.success) return reply.status(400).send({ error: 'Invalid input' });
    const { email } = parsed.data;

    const { userId } = request.user;
    const db = getDb();
    db.prepare('UPDATE users SET email = ? WHERE id = ?').run(email ?? null, userId);
    const user = db.prepare('SELECT id, email FROM users WHERE id = ?').get(userId) as
      { id: string; email: string | null };
    const profile: UserProfile = { id: user.id, email: user.email };
    return profile;
  });
}
