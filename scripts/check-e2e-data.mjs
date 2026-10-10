// Runs after the end-to-end tests, once their server has stopped: the built-in database they used must still open
// and answer. Two processes opening one PGlite folder leave it unreadable ("Aborted()"), and only this catches it.
import { existsSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';

const dir = process.argv[2] ?? '.data/e2e';
if (!existsSync(dir)) {
  console.error(`check-e2e-data: ${dir} does not exist; did the end-to-end tests run?`);
  process.exit(1);
}
try {
  const client = new PGlite(dir);
  const { rows } = await client.query('select count(*)::int as n from "user"');
  await client.close();
  console.log(`check-e2e-data: ${dir} opens fine (${rows[0].n} accounts).`);
} catch (err) {
  console.error(`check-e2e-data: ${dir} is unreadable after the end-to-end run:`, err);
  process.exit(1);
}
