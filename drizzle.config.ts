import { defineConfig } from "drizzle-kit";

// `npm run db:generate` writes SQL from schema.ts and needs no database. Migrations are applied by
// scripts/migrate.mjs (before `npm run dev` and `npm run build`). `db:studio` opens Neon when DATABASE_URL is set,
// otherwise the built-in database in .data/pglite.
export default defineConfig({
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle/migrations",
  dialect: "postgresql",
  ...(process.env.DATABASE_URL
    ? { dbCredentials: { url: process.env.DATABASE_URL } }
    : { driver: "pglite", dbCredentials: { url: process.env.GUILDHALL_DATA_DIR ?? ".data/pglite" } }),
  verbose: true,
  strict: true,
});
