// Better-Auth for Guildhall: email and password, no email service, sessions in our own database, and OAuth sign-in
// for agents.
import { betterAuth, type BetterAuthOptions } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { jwt } from "better-auth/plugins";
import { mcp } from "@better-auth/mcp";
import { AGENT_SCOPES } from "@/lib/agent-access";
import { signUpGate } from "@/lib/access";
import { demoGuard } from "@/lib/demo";
import { db, type Db } from "@/lib/db/client";
import * as schema from "@/lib/db/schema";
import { env } from "@/lib/env";

// The address agents connect to; tokens are issued for it alone.
export const MCP_RESOURCE = `${env.authUrl}/mcp`;

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
    // I5: agents sign in as a person with OAuth. They register themselves (public clients, so PKCE is required), and
    // the person picks what they may do on /consent, signing in on /signin first if needed.
    plugins: [
      jwt(),
      mcp({
        resource: MCP_RESOURCE,
        scopes: AGENT_SCOPES,
        loginPage: "/signin",
        consentPage: "/consent",
        allowDynamicClientRegistration: true,
        allowUnauthenticatedClientRegistration: true,
      }),
    ],
  } satisfies BetterAuthOptions;
}

function createAuth() {
  return betterAuth(authOptions(db, env.demoEmail));
}
type Auth = ReturnType<typeof createAuth>;

// Made on first use, not on import: Better-Auth starts up as soon as it is made, and the OAuth plugin then writes the
// /mcp resource row, which would open the database in build and helper processes that never serve a request.
let real: Auth | undefined;
export const auth: Auth = new Proxy({} as Auth, {
  get: (_target, prop) => Reflect.get((real ??= createAuth()), prop),
  has: (_target, prop) => Reflect.has((real ??= createAuth()), prop),
});

export type Session = Auth["$Infer"]["Session"];
