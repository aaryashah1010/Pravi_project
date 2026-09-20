import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { CreateProjectSchema, UpdateProjectSchema } from '@infraflow/shared';
import * as service from './projects.service.js';
import { getWorkflow } from '../workflows/workflow-view.js';
import { getProjectBlockers } from '../workflows/blockers.service.js';

const Id = z.object({ id: z.string().uuid() });
const ListQuery = z.object({
  status: z.enum(['ACTIVE', 'AT_RISK', 'BLOCKED', 'COMPLETED', 'CLOSED', 'CANCELLED', 'ON_HOLD']).optional(),
  stage: z.string().optional(),
  q: z.string().max(100).optional(),
  limit: z.coerce.number().int().positive().max(200).optional(),
});

export async function projectsRoutes(app: FastifyInstance) {
  const read = { preHandler: app.perm('project.read') };
  const update = { preHandler: app.perm('project.update') };

  app.get('/projects', read, async (req) => service.listProjects(app.db, req.ctx.actor!, ListQuery.parse(req.query)));

  app.post('/projects', { preHandler: app.perm('project.create') }, async (req, reply) => {
    const created = await service.createProject(app.db, req.ctx, CreateProjectSchema.parse(req.body));
    reply.code(201);
    return created;
  });

  app.get('/projects/:id', read, async (req) => service.getProjectDetail(app.db, req.ctx.actor!, Id.parse(req.params).id));

  app.patch('/projects/:id', update, async (req) =>
    service.updateProject(app.db, req.ctx, Id.parse(req.params).id, UpdateProjectSchema.parse(req.body)),
  );

  app.post('/projects/:id/submit', update, async (req) => service.submitProject(app.db, req.ctx, Id.parse(req.params).id));

  app.get('/projects/:id/workflow', read, async (req) => getWorkflow(app.db, req.ctx.actor!, Id.parse(req.params).id, req.ctx.now));
  app.get('/projects/:id/blockers', read, async (req) =>
    getProjectBlockers(app.db, req.ctx.actor!, Id.parse(req.params).id, req.ctx.now),
  );
  app.get('/projects/:id/graph', read, async (req) => getWorkflow(app.db, req.ctx.actor!, Id.parse(req.params).id, req.ctx.now));
}
