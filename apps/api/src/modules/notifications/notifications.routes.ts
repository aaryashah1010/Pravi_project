import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import * as service from './notifications.service.js';

export async function notificationsRoutes(app: FastifyInstance) {
  app.get('/notifications', { preHandler: app.auth }, async (req) => {
    const { unread } = z.object({ unread: z.enum(['true', 'false']).optional() }).parse(req.query);
    return service.listNotifications(app.db, req.ctx, unread === 'true');
  });
  app.post('/notifications/read-all', { preHandler: app.auth }, async (req) => service.markRead(app.db, req.ctx, 'all'));
  app.post('/notifications/:id/read', { preHandler: app.auth }, async (req) =>
    service.markRead(app.db, req.ctx, z.object({ id: z.string().uuid() }).parse(req.params).id),
  );
}
