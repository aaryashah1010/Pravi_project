import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

// .env (user-created, gitignored, holds real keys) wins; .env.example fills any gaps for local dev.
dotenv.config({ path: path.join(ROOT, '.env') });
dotenv.config({ path: path.join(ROOT, '.env.example') });

export const DB_DIR = path.join(ROOT, 'infraflow-gov-project', 'db');
