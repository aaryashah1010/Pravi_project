import pg from 'pg';
import './env.js';

export type DbTarget = 'main' | 'test' | { url: string };

export function connectionString(target: DbTarget = 'main'): string {
  if (typeof target === 'object') return target.url;
  const url = target === 'test' ? process.env.TEST_DATABASE_URL : process.env.DATABASE_URL;
  if (!url) throw new Error(`Missing ${target === 'test' ? 'TEST_DATABASE_URL' : 'DATABASE_URL'}`);
  return url;
}

export function targetFromArgs(argv: string[] = process.argv.slice(2)): DbTarget {
  return argv.includes('--test') || process.env.DB_TARGET === 'test' ? 'test' : 'main';
}

export function dbName(url: string): string {
  return decodeURIComponent(new URL(url).pathname.slice(1));
}

export function withDbName(url: string, name: string): string {
  const u = new URL(url);
  u.pathname = `/${name}`;
  return u.toString();
}

export async function withClient<T>(target: DbTarget, fn: (c: pg.Client) => Promise<T>): Promise<T> {
  const client = new pg.Client({ connectionString: connectionString(target) });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}
