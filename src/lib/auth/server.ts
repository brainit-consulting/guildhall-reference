// Better-Auth for Guildhall: email and password, no email service, sessions in our own database.
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "@/lib/db/client";
import * as schema from "@/lib/db/schema";
import { env } from "@/lib/env";

export const auth = betterAuth({
  // the schema passed here keeps Better-Auth from reading db at start-up, so only a real query opens the database
  database: drizzleAdapter(db, { provider: "pg", schema }),
  secret: env.authSecret,
  baseURL: env.authUrl,
  trustedOrigins: env.trustedOrigins,
  emailAndPassword: { enabled: true, autoSignIn: true, minPasswordLength: 8, requireEmailVerification: false },
  user: { additionalFields: { role: { type: "string", defaultValue: "member", input: false } } },
  session: { expiresIn: 60 * 60 * 24 * 30, updateAge: 60 * 60 * 24 },
});

export type Session = typeof auth.$Infer.Session;
