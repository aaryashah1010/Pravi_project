import { resetDb } from '../../../scripts/db-reset.js';

// Rebuild infraflow_test from the cached template once per test run (~12s warm).
// SKIP_DB_RESET=1 reuses the current test DB for fast iteration (tests use unique codes and tolerate leftovers).
export default async function setup() {
  if (process.env.SKIP_DB_RESET === '1') return;
  await resetDb('test', () => {});
}
