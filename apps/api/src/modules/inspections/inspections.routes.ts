import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { CreateInspectionSchema, SubmitInspectionSchema } from '@infraflow/shared';
import * as service from './inspections.service.js';

const Id = z.object({ id: z.string().uuid() });

export async function inspectionsRoutes(app: FastifyInstance) {
  app.get('/projects/:id/inspections', { preHandler: app.perm('project.read') }, async (req) =>
    service.listInspections(app.db, req.ctx.actor!, Id.parse(req.params).id),
  );

  app.get('/inspections/:id', { preHandler: app.perm('project.read') }, async (req) =>
    service.getInspection(app.db, req.ctx.actor!, Id.parse(req.params).id),
  );

  // Contractors may REQUEST an inspection; only inspectors submit results.
  app.post('/projects/:id/inspections', { preHandler: app.perm('inspection.create', 'contractor.submit_progress') }, async (req, reply) => {
    const created = await service.requestInspection(app.db, req.ctx, Id.parse(req.params).id, CreateInspectionSchema.parse(req.body));
    reply.code(201);
    return created;
  });

  app.post('/inspections/:id/submit', { preHandler: app.perm('inspection.submit') }, async (req) =>
    service.submitInspection(app.db, req.ctx, Id.parse(req.params).id, SubmitInspectionSchema.parse(req.body)),
  );
}
