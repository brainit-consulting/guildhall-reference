// The database: Neon when DATABASE_URL is set (the live app on Vercel), otherwise PGlite, a Postgres that runs
// inside the app and keeps its files in .data/ (every worktree and preview gets its own, with no setup).
import { neon } from "@neondatabase/serverless";
import { PGlite } from "@electric-sql/pglite";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { drizzle as drizzleNeon } from "drizzle-orm/neon-http";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { env } from "@/lib/env";
import * as schema from "./schema";

export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

// Next's dev server re-runs modules on every edit; one PGlite per folder per process, or the second one finds the
// folder locked.
const open = ((globalThis as { guildhallPglite?: Map<string, PGlite> }).guildhallPglite ??= new Map());

export function localClient(dir: string): PGlite {
  let c = open.get(dir);
  if (!c) open.set(dir, (c = new PGlite(dir)));
  return c;
}

export const db: Db = env.databaseUrl
  ? (drizzleNeon(neon(env.databaseUrl), { schema }) as unknown as Db)
  : (drizzlePglite(localClient(env.dataDir), { schema }) as unknown as Db);
