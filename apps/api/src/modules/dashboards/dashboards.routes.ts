import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import * as service from './dashboards.service.js';
import { listApprovals } from '../approvals/approvals.service.js';

const Limit = z.object({ limit: z.coerce.number().int().positive().max(50).optional() });

export async function dashboardsRoutes(app: FastifyInstance) {
  const read = { preHandler: app.perm('dashboard.read') };

  app.get('/dashboard/summary', read, async (req) => service.summary(app.db, req.ctx));
  app.get('/dashboard/attention', read, async (req) => service.attention(app.db, req.ctx, Limit.parse(req.query).limit ?? 5));
  app.get('/dashboard/overdue', read, async (req) => service.overdue(app.db, req.ctx, Limit.parse(req.query).limit ?? 20));
  app.get('/dashboard/approvals', read, async (req) => {
    const rows = await listApprovals(app.db, req.ctx, { status: 'open' });
    return rows.sort((a, b) => b.ageDays - a.ageDays).slice(0, Limit.parse(req.query).limit ?? 10);
  });
}
