import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import * as service from './rules.service.js';

const IdParams = z.object({ id: z.string().uuid() });
const ListQuery = z.object({
  category: z.string().optional(),
  verification: z.enum(['DRAFT', 'VERIFIED', 'UNVERIFIED', 'SUPERSEDED', 'DISABLED']).optional(),
  q: z.string().max(100).optional(),
});

export async function rulesRoutes(app: FastifyInstance) {
  const read = { preHandler: app.perm('project.read', 'rule.manage') };

  app.get('/rules', read, async (req) => service.listRules(app.db, ListQuery.parse(req.query)));

  app.get('/rules/:id', read, async (req) => {
    const { id } = IdParams.parse(req.params);
    return (await service.getProvenance(app.db, id)).rule;
  });

  app.get('/rules/:id/provenance', read, async (req) => {
    const { id } = IdParams.parse(req.params);
    return service.getProvenance(app.db, id);
  });
}
