/**
 * Roll back one migration by running its `.down.sql` file in a single transaction.
 *
 * Usage:  node scripts/run-down-migration.mjs 0016_contacts_single_source
 *
 * Remove the matching `.up.sql` from run-safe-migration.mjs as well, otherwise
 * the next migration run applies it again.
 */

import { readFileSync, existsSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, '..');

const envPath = resolve(rootDir, 'backend', '.env');
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
    if (!process.env[key]) process.env[key] = val;
  }
}

const name = process.argv[2];
if (!name) {
  console.error('Usage: node scripts/run-down-migration.mjs <migration name, e.g. 0016_contacts_single_source>');
  process.exit(1);
}
const file = resolve(rootDir, 'backend', 'migrations', `${name.replace(/(\.down)?\.sql$/, '')}.down.sql`);
if (!existsSync(file)) {
  console.error(`❌ Not found: ${file}`);
  process.exit(1);
}
if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL environment variable is not set.');
  process.exit(1);
}

const { default: pg } = await import('pg');
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
try {
  console.log(`⏪ Rolling back: ${name}`);
  await client.query('BEGIN');
  await client.query(readFileSync(file, 'utf8'));
  await client.query('COMMIT');
  console.log('✅ Rolled back.');
} catch (err) {
  await client.query('ROLLBACK').catch(() => {});
  console.error(`❌ Rollback failed: ${err.message}`);
  process.exitCode = 1;
} finally {
  await client.end();
}
