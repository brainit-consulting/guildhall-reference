// Guildhall's settings, checked in one place. On this computer nothing is needed: the built-in database and a
// development secret. On Vercel the database address and a real secret are required, and a missing one stops
// the app with its name rather than running live on stand-ins.
import { z } from "zod";

export const DEV_SECRET = "guildhall-development-secret-never-used-live";

const schema = z.object({
  DATABASE_URL: z.string().min(1).optional(),
  BETTER_AUTH_SECRET: z.string().min(32, "must be at least 32 characters").optional(),
  BETTER_AUTH_URL: z.string().url().optional(),
  PORT: z.string().regex(/^\d+$/).default("3000"),
  VERCEL: z.string().optional(),
  VERCEL_PROJECT_PRODUCTION_URL: z.string().optional(),
  GUILDHALL_DATA_DIR: z.string().default(".data/pglite"),
});

export type Env = {
  databaseUrl: string | null;
  authSecret: string;
  authUrl: string;
  onVercel: boolean;
  dataDir: string;
  /** Extra origins sign-in accepts: any local port on this computer (a coder may use `-p` or 127.0.0.1), none live. */
  trustedOrigins: string[];
};

const LOCAL = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;

export function parseEnv(raw: Record<string, string | undefined>): Env {
  const r = schema.safeParse(raw);
  if (!r.success)
    throw new Error("Invalid environment:\n" + r.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`).join("\n"));
  const e = r.data;
  const onVercel = e.VERCEL === "1";
  const missing = onVercel ? (["DATABASE_URL", "BETTER_AUTH_SECRET"] as const).filter((k) => !e[k]) : [];
  if (missing.length)
    throw new Error(`Invalid environment:\n${missing.map((k) => `  - ${k}: required on Vercel (Project > Settings > Environment Variables)`).join("\n")}`);
  const authUrl = e.BETTER_AUTH_URL
    ?? (onVercel && e.VERCEL_PROJECT_PRODUCTION_URL ? `https://${e.VERCEL_PROJECT_PRODUCTION_URL}` : `http://localhost:${e.PORT}`);
  const local = !onVercel && LOCAL.test(authUrl);
  // the development secret is public in this repo: anywhere but this computer it would let anyone forge a sign-in
  if (!local && !e.BETTER_AUTH_SECRET)
    throw new Error(`Invalid environment:\n  - BETTER_AUTH_SECRET: required when the app runs at ${authUrl}`);
  return {
    databaseUrl: e.DATABASE_URL ?? null,
    authSecret: e.BETTER_AUTH_SECRET ?? DEV_SECRET,
    authUrl,
    onVercel,
    dataDir: e.GUILDHALL_DATA_DIR,
    trustedOrigins: local ? ["http://localhost:*", "http://127.0.0.1:*"] : [],
  };
}

export const env: Env = parseEnv(process.env);
