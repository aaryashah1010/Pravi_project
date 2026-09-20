import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import rateLimit from '@fastify/rate-limit';
import { randomUUID } from 'node:crypto';
import { type AppConfig, loadConfig } from './config.js';
import { createPool, type Db } from './platform/db.js';
import { errorHandler, errorEnvelope } from './platform/errors.js';
import { registerEnvelope, registerGuards } from './platform/http.js';
import { ActorCache } from './modules/auth/auth.service.js';
import { authRoutes } from './modules/auth/auth.routes.js';
import { orgRoutes } from './modules/org/org.routes.js';
import { rulesRoutes } from './modules/rules/rules.routes.js';
import { projectsRoutes } from './modules/projects/projects.routes.js';
import { approvalsRoutes } from './modules/approvals/approvals.routes.js';
import { tasksRoutes } from './modules/tasks/tasks.routes.js';
import { documentsRoutes } from './modules/documents/documents.routes.js';
import { notificationsRoutes } from './modules/notifications/notifications.routes.js';
import { dashboardsRoutes } from './modules/dashboards/dashboards.routes.js';
import { auditRoutes } from './modules/audit/audit.routes.js';
import { issuesRoutes } from './modules/issues/issues.routes.js';
import { constructionRoutes } from './modules/construction/construction.routes.js';
import { inspectionsRoutes } from './modules/inspections/inspections.routes.js';
import { contractsRoutes } from './modules/contracts/contracts.routes.js';
import { aiRoutes } from './modules/ai/ai.routes.js';
import { DeterministicProvider } from './modules/ai/providers/deterministic.js';
import { OpenAiProvider } from './modules/ai/providers/openai.js';
import type { AiProvider } from './modules/ai/ai.types.js';
import { startJobs } from './platform/jobs.js';

export interface BuiltApp {
  app: FastifyInstance;
  db: Db;
}

export interface BuildOptions {
  /** Test hook: replace the primary AI provider (the deterministic provider remains the fallback). */
  aiProvider?: AiProvider;
}

export async function buildApp(overrides: Partial<AppConfig> = {}, opts: BuildOptions = {}): Promise<BuiltApp> {
  const config = loadConfig(overrides);
  const db = createPool(config.databaseUrl);

  const app = Fastify({
    logger: config.logLevel === 'silent' ? false : { level: config.logLevel },
    genReqId: (req) => (req.headers['x-request-id'] as string) || randomUUID(),
    disableRequestLogging: config.nodeEnv === 'test',
  });

  app.decorate('db', db);
  app.decorate('config', config);
  app.decorate('actors', new ActorCache(db, config.actorCacheTtlMs));
  const fallback = new DeterministicProvider();
  const provider = opts.aiProvider ?? (config.openaiApiKey ? new OpenAiProvider(config.openaiApiKey, config.openaiModel, config.aiTimeoutMs) : fallback);
  app.decorate('ai', { provider, fallback });

  await app.register(cors, { origin: config.corsOrigins, credentials: true });
  await app.register(rateLimit, { global: false });
  await app.register(jwt, { secret: config.jwtSecret });

  registerEnvelope(app);
  registerGuards(app);
  app.setErrorHandler(errorHandler);
  app.setNotFoundHandler((req, reply) =>
    reply.status(404).send(errorEnvelope(req.id, 'NOT_FOUND', `Route ${req.method} ${req.url} was not found.`)),
  );

  app.get('/health', async () => ({ status: 'ok' }));

  await app.register(
    async (api) => {
      await api.register(authRoutes);
      await api.register(orgRoutes);
      await api.register(rulesRoutes);
      await api.register(projectsRoutes);
      await api.register(approvalsRoutes);
      await api.register(tasksRoutes);
      await api.register(documentsRoutes);
      await api.register(notificationsRoutes);
      await api.register(dashboardsRoutes);
      await api.register(auditRoutes);
      await api.register(issuesRoutes);
      await api.register(constructionRoutes);
      await api.register(inspectionsRoutes);
      await api.register(contractsRoutes);
      await api.register(aiRoutes);
    },
    { prefix: '/api/v1' },
  );

  startJobs(app);
  app.addHook('onClose', async () => {
    await db.end();
  });

  return { app, db };
}
