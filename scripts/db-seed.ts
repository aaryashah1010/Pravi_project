import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';
import type pg from 'pg';
import { DB_DIR } from './lib/env.js';
import { type DbTarget, targetFromArgs, withClient } from './lib/db.js';

export async function seed(target: DbTarget = 'main', log = console.log): Promise<void> {
  await withClient(target, async (c: pg.Client) => {
    const dir = path.join(DB_DIR, 'seeds');
    const files = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
    for (const name of files) {
      const sql = readFileSync(path.join(dir, name), 'utf8');
      try {
        await c.query('BEGIN');
        await c.query(sql);
        await c.query('COMMIT');
      } catch (e) {
        await c.query('ROLLBACK');
        throw new Error(`Seed ${name} failed: ${(e as Error).message}`);
      }
      log(`  seeded ${name}`);
    }

    // Password hashes are computed here (never committed). Only demo accounts get one.
    const col = await c.query(
      `SELECT 1 FROM information_schema.columns WHERE table_name='app_users' AND column_name='password_hash'`,
    );
    if (col.rowCount) {
      const pwd = process.env.DEMO_PASSWORD ?? 'Demo@12345';
      const hash = await bcrypt.hash(pwd, 10);
      const r = await c.query(
        `UPDATE app_users SET password_hash = $1 WHERE password_hash IS NULL AND email LIKE '%@demo.infraflow.local'`,
        [hash],
      );
      log(`  demo password set for ${r.rowCount} user(s)`);
    }
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  seed(targetFromArgs()).catch((e) => {
    console.error(e.message);
    process.exit(1);
  });
}
