import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { PlanMilestoneSchema, ProgressSchema } from '@infraflow/shared';
import * as service from './construction.service.js';

const Id = z.object({ id: z.string().uuid() });

export async function constructionRoutes(app: FastifyInstance) {
  app.get('/projects/:id/milestones', { preHandler: app.perm('project.read') }, async (req) =>
    service.listMilestones(app.db, req.ctx.actor!, Id.parse(req.params).id),
  );

  app.post('/milestones/:id/progress', { preHandler: app.perm('milestone.update', 'contractor.submit_progress') }, async (req) =>
    service.reportProgress(app.db, req.ctx, Id.parse(req.params).id, ProgressSchema.parse(req.body)),
  );

  app.post('/milestones/:id/plan', { preHandler: app.perm('milestone.update') }, async (req) =>
    service.planMilestone(app.db, req.ctx, Id.parse(req.params).id, PlanMilestoneSchema.parse(req.body)),
  );
}
