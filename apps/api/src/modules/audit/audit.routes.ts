import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import * as service from './audit.service.js';

const Query = z.object({
  projectId: z.string().uuid().optional(),
  actorUserId: z.string().uuid().optional(),
  action: z.string().max(80).optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  before: z.string().datetime().optional(),
  limit: z.coerce.number().int().positive().max(200).optional(),
});

export async function auditRoutes(app: FastifyInstance) {
  app.get('/audit', { preHandler: app.perm('audit.read') }, async (req) => service.listAudit(app.db, req.ctx.actor!, Query.parse(req.query)));
  app.get('/projects/:id/audit', { preHandler: app.perm('audit.read') }, async (req) => {
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const q = Query.parse(req.query);
    return service.listAudit(app.db, req.ctx.actor!, { ...q, projectId: id });
  });
}
