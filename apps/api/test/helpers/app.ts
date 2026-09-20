import type { FastifyInstance } from 'fastify';
import { type BuildOptions, buildApp } from '../../src/app.js';
import { TEST_DATABASE_URL } from './testdb.js';

export async function makeTestApp(opts: BuildOptions = {}): Promise<FastifyInstance> {
  const { app } = await buildApp({
    databaseUrl: TEST_DATABASE_URL,
    jwtSecret: 'test-secret-test-secret-test-secret',
    actorCacheTtlMs: 0,
    logLevel: (process.env.TEST_LOG as string) ?? 'silent',
    nodeEnv: 'test',
    runBackgroundJobs: false,
    allowDemoClock: true,
    openaiApiKey: '',
  }, opts);
  await app.ready();
  return app;
}

export const DEMO_PASSWORD = process.env.DEMO_PASSWORD ?? 'Demo@12345';

export async function loginAs(app: FastifyInstance, prefix: string): Promise<string> {
  const res = await app.inject({
    method: 'POST',
    url: '/api/v1/auth/login',
    payload: { email: `${prefix}@demo.infraflow.local`, password: DEMO_PASSWORD },
  });
  if (res.statusCode !== 200) throw new Error(`login ${prefix} failed: ${res.statusCode} ${res.body}`);
  return res.json().data.token as string;
}

export const bearer = (token: string) => ({ authorization: `Bearer ${token}` });
