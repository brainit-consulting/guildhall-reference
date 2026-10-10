// Who may have an account (B6): the first person to sign up is the owner; after that, only emails the owner has
// added in Settings. Plain functions on `db`, so the sign-up hook, the Settings page and later the MCP tools share them.
import { asc, eq } from "drizzle-orm";
import { APIError } from "better-auth/api";
import { z } from "zod";
import type { Db } from "@/lib/db/client";
import { allowedEmail, user } from "@/lib/db/schema";
import { authErrorMessage, isEmail } from "@/lib/auth/messages";

export type Role = "owner" | "member";

export function normaliseEmail(email: string): string {
  return email.trim().toLowerCase();
}

// null means sign-up is closed to this email.
export async function roleForNewAccount(db: Db, email: string): Promise<Role | null> {
  const [anyone] = await db.select({ id: user.id }).from(user).limit(1);
  if (!anyone) return "owner";
  const [allowed] = await db.select({ id: allowedEmail.id }).from(allowedEmail)
    .where(eq(allowedEmail.email, normaliseEmail(email))).limit(1);
  return allowed ? "member" : null;
}

// Better-Auth's `user.create.before` hook: sets the new account's role, or refuses the sign-up.
export function signUpGate(db: Db) {
  return async <U extends { email: string }>(newUser: U) => {
    const role = await roleForNewAccount(db, newUser.email);
    if (!role) throw APIError.from("FORBIDDEN", { code: "SIGN_UP_CLOSED", message: authErrorMessage("SIGN_UP_CLOSED") });
    return { data: { ...newUser, role } };
  };
}

export type AllowedEmail = { id: string; email: string; createdAt: Date };

export async function listAllowedEmails(db: Db): Promise<AllowedEmail[]> {
  return db.select().from(allowedEmail).orderBy(asc(allowedEmail.email));
}

// Returns a sentence for the form when the email can't be added.
export async function addAllowedEmail(db: Db, raw: string): Promise<{ error: string } | { error: null }> {
  const email = normaliseEmail(raw);
  if (!email) return { error: "Enter an email address." };
  if (!isEmail(email)) return { error: authErrorMessage("INVALID_EMAIL") };
  const added = await db.insert(allowedEmail).values({ email }).onConflictDoNothing().returning({ id: allowedEmail.id });
  if (added.length === 0) return { error: "That email is already on the list." };
  return { error: null };
}

export async function removeAllowedEmail(db: Db, id: string): Promise<void> {
  if (!z.uuid().safeParse(id).success) return; // a tampered form; Postgres would reject it as a uuid
  await db.delete(allowedEmail).where(eq(allowedEmail.id, id));
}
