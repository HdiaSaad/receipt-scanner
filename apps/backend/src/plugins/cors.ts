import fp from 'fastify-plugin';
import fastifyCors from '@fastify/cors';
import type { FastifyInstance } from 'fastify';

export const corsPlugin = fp(async (fastify: FastifyInstance) => {
  fastify.register(fastifyCors, {
    origin: process.env.NODE_ENV === 'production'
      ? ['capacitor://localhost', 'ionic://localhost']
      : true,
    credentials: true,
  });
});
