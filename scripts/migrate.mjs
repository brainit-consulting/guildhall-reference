// Brings the database up to date before the app starts or builds: Neon when DATABASE_URL is set, otherwise the
// built-in database in .data/pglite. Vercel preview builds skip it (scripts/migrate-target.mjs).
import { mkdirSync } from 'node:fs';
import { migrationTarget } from './migrate-target.mjs';

const folder = 'drizzle/migrations';
const target = migrationTarget(process.env);
if (target === 'skip') {
  console.log('Preview build: migrations run only for the production build.');
} else if (target === 'neon') {
  const { neon } = await import('@neondatabase/serverless');
  const { drizzle } = await import('drizzle-orm/neon-http');
  const { migrate } = await import('drizzle-orm/neon-http/migrator');
  await migrate(drizzle(neon(process.env.DATABASE_URL)), { migrationsFolder: folder });
  console.log('Database up to date (DATABASE_URL).');
} else {
  const { PGlite } = await import('@electric-sql/pglite');
  const { drizzle } = await import('drizzle-orm/pglite');
  const { migrate } = await import('drizzle-orm/pglite/migrator');
  const dir = process.env.GUILDHALL_DATA_DIR ?? '.data/pglite';
  mkdirSync(dir, { recursive: true });
  const client = new PGlite(dir);
  await migrate(drizzle(client), { migrationsFolder: folder });
  await client.close();
  console.log(`Built-in database up to date (${dir}).`);
}
