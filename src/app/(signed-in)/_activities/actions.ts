"use server";

import { refresh } from "next/cache";
import { requireSession } from "@/lib/auth/session";
import { db } from "@/lib/db/client";
import { logActivity, type ActivityErrors, type ActivityInput, type ActivityTarget } from "@/lib/activities";

// `attempt` changes on every answer, so the form remounts: with what was typed after a refusal, emptied after a save.
export type LogActivityState = { errors: ActivityErrors; values: ActivityInput; attempt: number };

// Checks the session itself: server actions can be called by anyone who can send a POST. The target is bound by the
// page, but a bound argument still arrives from the browser, so logActivity checks the record exists.
export async function logActivityAction(target: ActivityTarget, prev: LogActivityState, form: FormData): Promise<LogActivityState> {
  const { user } = await requireSession();
  const values: ActivityInput = { kind: String(form.get("kind") ?? ""), body: String(form.get("body") ?? "") };
  const saved = await logActivity(db, target, user.id, values);
  if (saved.errors) return { errors: saved.errors, values, attempt: prev.attempt + 1 };
  refresh(); // the timeline is rendered by the page
  return { errors: {}, values: { kind: values.kind, body: "" }, attempt: prev.attempt + 1 };
}
