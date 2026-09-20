import pg from 'pg';

// DATE stays a 'YYYY-MM-DD' string (no timezone shift); BIGINT (counts, version_no) becomes a number.
// NUMERIC (money) stays a string on purpose: never floats.
pg.types.setTypeParser(1082, (v) => v);
pg.types.setTypeParser(20, (v) => parseInt(v, 10));

export interface Queryable {
  query<R extends pg.QueryResultRow = any>(sql: string, params?: unknown[]): Promise<pg.QueryResult<R>>;
}

export type Db = pg.Pool;

export function createPool(connectionString: string): Db {
  return new pg.Pool({ connectionString, max: 10 });
}

/** Run fn inside one transaction. State change + audit + outbox must all happen inside the same call. */
export async function withTx<T>(pool: Db, fn: (tx: Queryable) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const out = await fn(client);
    await client.query('COMMIT');
    return out;
  } catch (e) {
    await client.query('ROLLBACK').catch(() => undefined);
    throw e;
  } finally {
    client.release();
  }
}
