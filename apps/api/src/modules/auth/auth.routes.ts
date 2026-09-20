import type { FastifyInstance } from 'fastify';
import { LoginRequestSchema, type LoginResponse } from '@infraflow/shared';
import { authenticate, toMe } from './auth.service.js';

export async function authRoutes(app: FastifyInstance) {
  app.post(
    '/auth/login',
    { config: { rateLimit: { max: 20, timeWindow: '1 minute' } } },
    async (req, reply): Promise<LoginResponse> => {
      const body = LoginRequestSchema.parse(req.body);
      const actor = await authenticate(app.db, req.ctx, body);
      const token = await reply.jwtSign({ sub: actor.userId }, { expiresIn: app.config.jwtExpiresIn });
      return { token, expiresIn: app.config.jwtExpiresIn, me: toMe(actor) };
    },
  );

  app.get('/auth/me', { preHandler: app.auth }, async (req) => toMe(req.ctx.actor!));
}
