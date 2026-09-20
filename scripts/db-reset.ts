import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DB_DIR } from './lib/env.js';
import { type DbTarget, connectionString, dbName, targetFromArgs, withClient, withDbName } from './lib/db.js';
import { migrate } from './db-migrate.js';
import { seed } from './db-seed.js';

/** Fingerprint of everything that defines a fresh database. Template is rebuilt only when this changes. */
function fingerprint(): string {
  const h = createHash('sha256');
  for (const sub of ['migrations', 'views', 'seeds']) {
    const dir = path.join(DB_DIR, sub);
    for (const f of readdirSync(dir).filter((x) => x.endsWith('.sql')).sort()) {
      h.update(`${sub}/${f}\n`).update(readFileSync(path.join(dir, f)));
    }
  }
  h.update(process.env.DEMO_PASSWORD ?? 'Demo@12345');
  h.update(readFileSync(fileURLToPath(new URL('./db-seed.ts', import.meta.url))));
  return h.digest('hex').slice(0, 32);
}

const q = (ident: string) => `"${ident.replace(/"/g, '""')}"`;

/**
 * Drop and recreate the database from a cached, fingerprinted template (migrated + seeded once).
 * ~1-2s after the first build; DROP SCHEMA CASCADE was ~15s on Docker-for-Windows.
 */
export async function resetDb(target: DbTarget = 'main', log = console.log): Promise<void> {
  if (process.env.NODE_ENV === 'production') throw new Error('db:reset is dev-only (NODE_ENV=production).');
  const url = connectionString(target);
  if (!/@(localhost|127\.0\.0\.1)[:/]/.test(url)) throw new Error('db:reset refuses to run against a non-local database.');

  const name = dbName(url);
  const tpl = `${name}_tpl`;
  const tplUrl = withDbName(url, tpl);
  const adminTarget: DbTarget = { url: withDbName(url, 'postgres') };
  const fp = fingerprint();

  const current = await withClient(adminTarget, async (c) => {
    const r = await c.query(`SELECT shobj_description(oid, 'pg_database') AS d FROM pg_database WHERE datname = $1`, [tpl]);
    return r.rowCount ? (r.rows[0].d as string | null) : undefined;
  });

  if (current !== fp) {
    log(`Building database template ${tpl} (migrations + seeds)...`);
    await withClient(adminTarget, async (c) => {
      await c.query(`DROP DATABASE IF EXISTS ${q(tpl)} WITH (FORCE)`);
      await c.query(`CREATE DATABASE ${q(tpl)}`);
    });
    await migrate({ url: tplUrl }, log);
    await seed({ url: tplUrl }, log);
    await withClient(adminTarget, (c) => c.query(`COMMENT ON DATABASE ${q(tpl)} IS '${fp}'`));
  }

  log(`Resetting ${name} from template...`);
  await withClient(adminTarget, async (c) => {
    await c.query(`DROP DATABASE IF EXISTS ${q(name)} WITH (FORCE)`);
    await c.query(`CREATE DATABASE ${q(name)} TEMPLATE ${q(tpl)}`);
  });
  log('Reset complete.');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  resetDb(targetFromArgs()).catch((e) => {
    console.error(e.message);
    process.exit(1);
  });
}
