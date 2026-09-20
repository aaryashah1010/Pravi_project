import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import * as service from './tasks.service.js';

const Id = z.object({ id: z.string().uuid() });

export async function tasksRoutes(app: FastifyInstance) {
  app.get('/tasks/mine', { preHandler: app.auth }, async (req) => service.listMyTasks(app.db, req.ctx));

  app.get('/projects/:id/tasks', { preHandler: app.perm('project.read') }, async (req) => {
    const { id } = Id.parse(req.params);
    return service.listProjectTasks(app.db, req.ctx, id);
  });

  app.post('/tasks/:id/complete', { preHandler: app.auth }, async (req) => {
    const { id } = Id.parse(req.params);
    const { versionNo } = z.object({ versionNo: z.number().int().positive().optional() }).parse(req.body ?? {});
    return service.completeTask(app.db, req.ctx, id, versionNo);
  });
}
