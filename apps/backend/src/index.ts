import Fastify from 'fastify';
import { corsPlugin } from './plugins/cors.js';
import { rateLimitPlugin } from './plugins/rate-limit.js';
import { jwtPlugin } from './plugins/jwt.js';
import { authRoutes } from './routes/auth.js';
import { receiptsRoutes } from './routes/receipts.js';
import { usersRoutes } from './routes/users.js';
import { initDb } from './db/client.js';

export function buildServer() {
  const server = Fastify({ logger: process.env.NODE_ENV !== 'test' });

  server.register(corsPlugin);
  server.register(rateLimitPlugin);
  server.register(jwtPlugin);

  server.register(authRoutes, { prefix: '/auth' });
  server.register(receiptsRoutes, { prefix: '/receipts' });
  server.register(usersRoutes, { prefix: '/users' });

  server.get('/health', async () => ({ status: 'ok' }));

  return server;
}

// Start only when executed directly, not when imported by tests
if (process.env.NODE_ENV !== 'test') {
  initDb();
  const server = buildServer();
  server.listen({ port: Number(process.env.PORT) || 3000, host: '0.0.0.0' });
}
