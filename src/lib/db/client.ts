// The database: Neon when DATABASE_URL is set (the live app on Vercel), otherwise PGlite, a Postgres that runs
// inside the app and keeps its files in .data/ (every worktree and preview gets its own, with no setup).
import { neon, Pool } from "@neondatabase/serverless";
import { PGlite } from "@electric-sql/pglite";
import type { PgDatabase, PgQueryResultHKT } from "drizzle-orm/pg-core";
import { drizzle as drizzleNeon } from "drizzle-orm/neon-http";
import { drizzle as drizzleNeonWs } from "drizzle-orm/neon-serverless";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { env } from "@/lib/env";
import * as schema from "./schema";

export type Db = PgDatabase<PgQueryResultHKT, typeof schema>;

// Next's dev server re-runs modules on every edit; one PGlite per folder per process, or the second one finds the
// folder locked.
const open = ((globalThis as { guildhallPglite?: Map<string, PGlite> }).guildhallPglite ??= new Map());

// PGlite takes the computer's time zone (standard time only: Etc/GMT+5 in New York), so `now()` would store local
// clock times in `timestamp` columns while Drizzle writes and reads them as UTC. UTC, as Neon runs, keeps them one
// clock. Written to the data folder's postgresql.conf, so it holds for folders made before this too.
export const PGLITE_OPTIONS = { postgresqlconf: "timezone = 'UTC'" };

export function localClient(dir: string): PGlite {
  let c = open.get(dir);
  if (!c) open.set(dir, (c = new PGlite(dir, PGLITE_OPTIONS)));
  return c;
}

// Neon over HTTP for every query, but that driver throws on `db.transaction()` ("No transactions support in
// neon-http driver"), which PGlite never does, so a transaction worked in every test and failed only on the live
// site. A transaction opens its own WebSocket connection instead and closes it when done: on Vercel a connection
// can't outlive one request.
function neonDb(url: string): Db {
  const http = drizzleNeon(neon(url), { schema }) as unknown as Db;
  const transaction: Db["transaction"] = async (work, config) => {
    const pool = new Pool({ connectionString: url });
    pool.on("error", (err: Error) => console.error("Neon transaction connection:", err));
    try {
      const ws = drizzleNeonWs(pool, { schema }) as unknown as Db;
      return await ws.transaction(work, config);
    } finally {
      await pool.end();
    }
  };
  return new Proxy(http, { get: (target, prop, receiver) => (prop === "transaction" ? transaction : Reflect.get(target, prop, receiver)) });
}

function connect(): Db {
  return env.databaseUrl ? neonDb(env.databaseUrl) : (drizzlePglite(localClient(env.dataDir), { schema }) as unknown as Db);
}

// Opened on first use, not on import: Next imports page modules in build and helper worker processes that never
// query, and a second process opening the same PGlite folder leaves it unreadable.
let real: Db | undefined;
export const db: Db = new Proxy({} as Db, {
  get(_target, prop) {
    const d = (real ??= connect());
    const value = Reflect.get(d, prop, d);
    return typeof value === "function" ? value.bind(d) : value;
  },
});
