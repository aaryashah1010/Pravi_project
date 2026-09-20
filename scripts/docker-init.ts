// Container start-up: apply pending migrations, then load the demo data once. Never resets or wipes anything.
// SEED_DEMO=0 skips reference/demo-user seeding; SEED_SCENARIOS=0 skips the backdated demo projects.
import { spawnSync } from 'node:child_process';
import './lib/env.js';
import { migrate } from './db-migrate.js';
import { seed } from './db-seed.js';
import { withClient } from './lib/db.js';

const on = (name: string, fallback: '0' | '1') => (process.env[name] ?? fallback) === '1';

const { applied } = await migrate('main');
console.log(applied.length ? `migrations applied: ${applied.length}` : 'migrations: up to date');

const users = await withClient('main', async (c) => (await c.query<{ n: number }>('SELECT count(*)::int AS n FROM app_users')).rows[0]!.n);

if (users === 0 && on('SEED_DEMO', '1')) {
  console.log('empty database: loading reference data and demo accounts');
  await seed('main');
}

if (on('SEED_DEMO', '1') && on('SEED_SCENARIOS', '1')) {
  // Skips itself when DEMO-INF-0001 already exists.
  const r = spawnSync(process.execPath, ['--import', 'tsx', 'scripts/seed-scenarios.ts'], { stdio: 'inherit' });
  if (r.status !== 0) console.warn('demo scenarios were not loaded (the API will still start); see the log above');
}
