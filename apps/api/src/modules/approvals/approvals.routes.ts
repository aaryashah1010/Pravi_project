import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { DecisionBodySchema, ManualAssignSchema } from '@infraflow/shared';
import * as service from './approvals.service.js';

const Id = z.object({ id: z.string().uuid() });
const ListQuery = z.object({
  status: z.string().optional(),
  projectId: z.string().uuid().optional(),
  mine: z.enum(['true', 'false']).optional(),
});

export async function approvalsRoutes(app: FastifyInstance) {
  const review = { preHandler: app.perm('approval.review', 'approval.decide') };
  const decide = { preHandler: app.perm('approval.decide') };

  app.get('/approvals', review, async (req) => {
    const q = ListQuery.parse(req.query);
    return service.listApprovals(app.db, req.ctx, { status: q.status, projectId: q.projectId, mine: q.mine === 'true' });
  });

  app.get('/approvals/:id', review, async (req) => service.getApproval(app.db, req.ctx, Id.parse(req.params).id));

  app.post('/approvals/:id/submit', { preHandler: app.perm('project.update') }, async (req) =>
    service.submitApproval(app.db, req.ctx, Id.parse(req.params).id),
  );

  const decision = (path: string, action: service.DecisionAction) =>
    app.post(`/approvals/:id/${path}`, decide, async (req) => {
      const { reason } = DecisionBodySchema.parse(req.body ?? {});
      return service.decideApproval(app.db, req.ctx, Id.parse(req.params).id, action, reason);
    });
  decision('approve', 'APPROVE');
  decision('return', 'RETURN');
  decision('reject', 'REJECT');
  decision('request-info', 'REQUEST_INFORMATION');

  app.post('/approvals/:id/manual-assign', { preHandler: app.perm('authority.manual_assign') }, async (req) => {
    const body = ManualAssignSchema.parse(req.body);
    return service.manualAssignAuthority(app.db, req.ctx, Id.parse(req.params).id, body.positionId, body.reason);
  });
}
