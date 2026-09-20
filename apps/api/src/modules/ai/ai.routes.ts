import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { AI_DISCLAIMER, AiAskSchema, AiNodeSchema, AiProjectSchema, type AiMode, type AiStatusDto } from '@infraflow/shared';
import * as service from './ai.service.js';
import { getProjectDetail } from '../projects/projects.service.js';

export async function aiRoutes(app: FastifyInstance) {
  const guard = {
    preHandler: app.perm('ai.use'),
    // Keyed by bearer token: the JWT guard runs later than the rate limiter.
    config: { rateLimit: { max: 30, timeWindow: '1 minute', keyGenerator: (req: { headers: Record<string, unknown>; ip: string }) => String(req.headers.authorization ?? req.ip) } },
  };
  const run = (mode: AiMode, extra: (body: unknown) => { projectId: string; question?: string; nodeCode?: string }) => async (req: { body: unknown; ctx: import('../../platform/context.js').RequestContext }) =>
    service.runAi(app.db, req.ctx, app.ai, app.config.aiTimeoutMs, { mode, ...extra(req.body) });

  app.get('/ai/status', { preHandler: app.auth }, async (): Promise<AiStatusDto> => ({
    provider: app.ai.provider.name, model: app.ai.provider.model, configured: app.ai.provider.name === 'openai', disclaimer: AI_DISCLAIMER,
  }));

  app.post('/ai/explain-blocker', guard, run('EXPLAIN_BLOCKER', (b) => AiProjectSchema.parse(b)));
  app.post('/ai/next-actions', guard, run('NEXT_ACTIONS', (b) => AiProjectSchema.parse(b)));
  app.post('/ai/missing-documents', guard, run('MISSING_DOCUMENTS', (b) => AiProjectSchema.parse(b)));
  app.post('/ai/summarize', guard, run('SUMMARIZE', (b) => AiProjectSchema.parse(b)));
  app.post('/ai/why-required', guard, run('WHY_REQUIRED', (b) => AiNodeSchema.parse(b)));
  app.post('/ai/ask', guard, run('ASK', (b) => AiAskSchema.parse(b)));

  app.get('/ai/runs', { preHandler: app.perm('ai.use') }, async (req) => {
    const { projectId } = z.object({ projectId: z.string().uuid() }).parse(req.query);
    await getProjectDetail(app.db, req.ctx.actor!, projectId); // scope check (404 if not visible)
    return service.listRuns(app.db, req.ctx, projectId);
  });
}
