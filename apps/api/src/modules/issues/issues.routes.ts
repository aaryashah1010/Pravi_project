import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { CreateIssueSchema, ResolveIssueSchema } from '@infraflow/shared';
import * as service from './issues.service.js';

const Id = z.object({ id: z.string().uuid() });

export async function issuesRoutes(app: FastifyInstance) {
  app.get('/projects/:id/issues', { preHandler: app.perm('project.read') }, async (req) => {
    const { status } = z.object({ status: z.enum(['open', 'all']).optional() }).parse(req.query);
    return service.listIssues(app.db, req.ctx.actor!, Id.parse(req.params).id, req.ctx.now, status ?? 'all');
  });

  app.post('/projects/:id/issues', { preHandler: app.perm('issue.manage') }, async (req, reply) => {
    const issue = await service.createIssue(app.db, req.ctx, Id.parse(req.params).id, CreateIssueSchema.parse(req.body));
    reply.code(201);
    return issue;
  });

  app.get('/issues/:id', { preHandler: app.perm('project.read') }, async (req) => service.getIssue(app.db, req.ctx.actor!, Id.parse(req.params).id, req.ctx.now));

  app.post('/issues/:id/resolve', { preHandler: app.perm('issue.manage') }, async (req) =>
    service.resolveIssue(app.db, req.ctx, Id.parse(req.params).id, ResolveIssueSchema.parse(req.body).resolution),
  );
}
