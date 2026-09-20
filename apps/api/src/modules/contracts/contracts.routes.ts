import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { ContractSchema } from '@infraflow/shared';
import * as service from './contracts.service.js';

const Id = z.object({ id: z.string().uuid() });

export async function contractsRoutes(app: FastifyInstance) {
  app.get('/projects/:id/contract', { preHandler: app.perm('project.read') }, async (req) =>
    service.getContract(app.db, req.ctx.actor!, Id.parse(req.params).id),
  );
  app.put('/projects/:id/contract', { preHandler: app.perm('project.update') }, async (req) =>
    service.recordContract(app.db, req.ctx, Id.parse(req.params).id, ContractSchema.parse(req.body)),
  );
}
