"use server";

import { refresh } from "next/cache";
import { addAllowedEmail, removeAllowedEmail } from "@/lib/access";
import { requireOwner } from "@/lib/auth/session";
import { db } from "@/lib/db/client";

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
