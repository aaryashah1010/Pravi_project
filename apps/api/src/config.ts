import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
// .env (user-created, gitignored) wins; .env.example fills gaps for local dev.
dotenv.config({ path: path.join(ROOT, '.env') });
dotenv.config({ path: path.join(ROOT, '.env.example') });

export interface AppConfig {
  nodeEnv: string;
  port: number;
  databaseUrl: string;
  jwtSecret: string;
  jwtExpiresIn: string;
  corsOrigins: string[];
  uploadDir: string;
  openaiApiKey: string;
  openaiModel: string;
  aiTimeoutMs: number;
  actorCacheTtlMs: number;
  runBackgroundJobs: boolean;
  /** DEV/SEED ONLY: honour an x-demo-now header so scenario history can be backdated. Never enabled on the served API. */
  allowDemoClock: boolean;
  logLevel: string;
}

export function loadConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  const env = process.env;
  const cfg: AppConfig = {
    nodeEnv: env.NODE_ENV ?? 'development',
    port: Number(env.API_PORT ?? 4000),
    databaseUrl: env.DATABASE_URL ?? '',
    jwtSecret: env.JWT_SECRET ?? '',
    jwtExpiresIn: env.JWT_EXPIRES_IN ?? '8h',
    corsOrigins: (env.CORS_ORIGINS ?? 'http://localhost:5173').split(',').map((s) => s.trim()),
    uploadDir: path.resolve(ROOT, env.UPLOAD_DIR ?? './apps/api/uploads'),
    openaiApiKey: env.OPENAI_API_KEY ?? '',
    openaiModel: env.OPENAI_MODEL ?? 'gpt-4o-mini',
    aiTimeoutMs: Number(env.AI_TIMEOUT_MS ?? 8000),
    actorCacheTtlMs: 15_000,
    runBackgroundJobs: true,
    allowDemoClock: false,
    logLevel: env.LOG_LEVEL ?? 'info',
    ...overrides,
  };
  if (!cfg.databaseUrl) throw new Error('DATABASE_URL is required');
  if (cfg.jwtSecret.length < 16) throw new Error('JWT_SECRET must be at least 16 characters');
  return cfg;
}
