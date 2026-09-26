import type { FastifyInstance } from 'fastify';
import { getDb } from '../db/client.js';
import type { UpdateUserRequest, UserProfile } from '@receipt-scanner/shared';

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

  fastify.put<{ Body: UpdateUserRequest }>('/me', async (request, reply) => {
    const { userId } = request.user;
    const { email } = request.body;
    const db = getDb();
    db.prepare('UPDATE users SET email = ? WHERE id = ?').run(email ?? null, userId);
    const user = db.prepare('SELECT id, email FROM users WHERE id = ?').get(userId) as
      { id: string; email: string | null };
    const profile: UserProfile = { id: user.id, email: user.email };
    return profile;
  });
}
