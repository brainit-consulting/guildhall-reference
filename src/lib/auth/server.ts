// Better-Auth for Guildhall: email and password, no email service, sessions in our own database.
import { betterAuth, type BetterAuthOptions } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { signUpGate } from "@/lib/access";
import { demoGuard } from "@/lib/demo";
import { db, type Db } from "@/lib/db/client";
import * as schema from "@/lib/db/schema";
import { env } from "@/lib/env";

// Built from a database and the demo email, so integration tests can run the real endpoints on createTestDb().
export function authOptions(database: Db, demoEmail: string | null) {
  return {
    // the schema passed here keeps Better-Auth from reading db at start-up, so only a real query opens the database
    database: drizzleAdapter(database, { provider: "pg", schema }),
    secret: env.authSecret,
    baseURL: env.authUrl,
    trustedOrigins: env.trustedOrigins,
    emailAndPassword: { enabled: true, autoSignIn: true, minPasswordLength: 8, requireEmailVerification: false },
    user: { additionalFields: { role: { type: "string", defaultValue: "member", input: false } } },
    // B6: the first account becomes the owner; after that only emails on the owner's list may sign up
    databaseHooks: { user: { create: { before: signUpGate(database) } } },
    // the shared showcase account can't have its password, email or name changed, or be deleted (src/lib/demo.ts)
    hooks: { before: demoGuard(demoEmail) },
    session: { expiresIn: 60 * 60 * 24 * 30, updateAge: 60 * 60 * 24 },
  } satisfies BetterAuthOptions;
}

export const auth = betterAuth(authOptions(db, env.demoEmail));

export type Session = typeof auth.$Infer.Session;
