import pg from 'pg';
import '../../../../scripts/lib/env.js';

export const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL!;

export function newPool(): pg.Pool {
  return new pg.Pool({ connectionString: TEST_DATABASE_URL, max: 4 });
}

export async function scalar<T = string>(pool: pg.Pool, sql: string, params: unknown[] = []): Promise<T> {
  const r = await pool.query(sql, params);
  return Object.values(r.rows[0])[0] as T;
}
