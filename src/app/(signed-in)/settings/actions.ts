"use server";

import { refresh } from "next/cache";
import { addAllowedEmail, removeAllowedEmail } from "@/lib/access";
import { requireOwner } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { resetDemoData, resetMessage } from "@/lib/demo-data";
import { env } from "@/lib/env";

// Each action checks the owner itself: server actions can be called by anyone who can send a POST.

export async function addAllowedEmailAction(_prev: { error: string | null }, form: FormData) {
  await requireOwner();
  const result = await addAllowedEmail(db, String(form.get("email") ?? ""));
  if (!result.error) refresh();
  return result;
}

export async function removeAllowedEmailAction(form: FormData) {
  await requireOwner();
  await removeAllowedEmail(db, String(form.get("id") ?? ""));
  refresh();
}

export type ResetState = { error: string | null; message: string | null };

// resetDemoData refuses too when DEMO_EMAIL isn't set, so a POST to a copy without it wipes nothing.
export async function resetDemoDataAction(): Promise<ResetState> {
  const s = await requireOwner();
  const result = await resetDemoData(db, s.user, env.demoEmail);
  if (result.counts === null) return { error: result.error, message: null };
  refresh();
  return { error: null, message: resetMessage(result.counts) };
}
