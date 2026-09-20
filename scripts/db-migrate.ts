import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type pg from 'pg';
import { DB_DIR } from './lib/env.js';
import { type DbTarget, targetFromArgs, withClient } from './lib/db.js';

const sha256 = (s: string) => createHash('sha256').update(s).digest('hex');

function sqlFiles(dir: string): { name: string; sql: string }[] {
  return readdirSync(dir)
    .filter((f) => f.endsWith('.sql'))
    .sort()
    .map((name) => ({ name, sql: readFileSync(path.join(dir, name), 'utf8') }));
}

export async function migrate(target: DbTarget = 'main', log = console.log): Promise<{ applied: string[] }> {
  return withClient(target, async (c: pg.Client) => {
    await c.query(`CREATE TABLE IF NOT EXISTS _migrations (
      name TEXT PRIMARY KEY,
      checksum TEXT NOT NULL,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`);
    const done = new Map<string, string>(
      (await c.query<{ name: string; checksum: string }>('SELECT name, checksum FROM _migrations')).rows.map((r) => [
        r.name,
        r.checksum,
      ]),
    );
    const applied: string[] = [];
    for (const { name, sql } of sqlFiles(path.join(DB_DIR, 'migrations'))) {
      const checksum = sha256(sql);
      const prior = done.get(name);
      if (prior) {
        if (prior !== checksum) throw new Error(`Migration ${name} changed after being applied (checksum drift). Migrations are frozen; add a new file.`);
        continue;
      }
      try {
        await c.query('BEGIN');
        await c.query(sql);
        await c.query('INSERT INTO _migrations(name, checksum) VALUES ($1, $2)', [name, checksum]);
        await c.query('COMMIT');
      } catch (e) {
        await c.query('ROLLBACK');
        throw new Error(`Migration ${name} failed: ${(e as Error).message}`);
      }
      applied.push(name);
      log(`  applied ${name}`);
    }
    // Views are CREATE OR REPLACE and depend on tables; re-apply every run.
    for (const { name, sql } of sqlFiles(path.join(DB_DIR, 'views'))) {
      await c.query(sql);
      log(`  view    ${name}`);
    }
    log(applied.length ? `Migrations applied: ${applied.length}` : 'Migrations: up to date');
    return { applied };
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  migrate(targetFromArgs()).catch((e) => {
    console.error(e.message);
    process.exit(1);
  });
}
