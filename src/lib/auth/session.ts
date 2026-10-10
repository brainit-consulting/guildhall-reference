// Reading the signed-in person on the server. Pages that need someone signed in call requireSession().
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth, type Session } from "./server";

export async function getSession(): Promise<Session | null> {
  return auth.api.getSession({ headers: await headers() });
}

export async function requireSession(): Promise<Session> {
  const s = await getSession();
  if (!s) redirect("/signin");
  return s;
}

// Owner-only pages and actions: anyone else is sent home.
export async function requireOwner(): Promise<Session> {
  const s = await requireSession();
  if (s.user.role !== "owner") redirect("/home");
  return s;
}
