import type { FastifyInstance } from 'fastify';
import { dispatchPending } from '../modules/notifications/notifications.service.js';
import { tickOverdue } from '../modules/tasks/tasks.jobs.js';

/** In-process background jobs: outbox dispatcher (2s) and SLA overdue ticker (60s). Disabled in tests. */
export function startJobs(app: FastifyInstance): void {
  if (!app.config.runBackgroundJobs) return;
  let dispatching = false;
  let ticking = false;
  const dispatcher = setInterval(async () => {
    if (dispatching) return;
    dispatching = true;
    try {
      await dispatchPending(app.db);
    } catch (err) {
      app.log.error({ err }, 'outbox dispatch failed');
    } finally {
      dispatching = false;
    }
  }, 2000);
  const ticker = setInterval(async () => {
    if (ticking) return;
    ticking = true;
    try {
      await tickOverdue(app.db);
    } catch (err) {
      app.log.error({ err }, 'overdue tick failed');
    } finally {
      ticking = false;
    }
  }, 60_000);
  app.addHook('onClose', async () => {
    clearInterval(dispatcher);
    clearInterval(ticker);
  });
}
