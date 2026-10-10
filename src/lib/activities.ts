// Activities (B11): the notes, calls, meetings and stage changes on a contact, company or deal. Plain functions on
// `db`, so the pages and later stage changes, last activity and the MCP log_activity tool share one set of rules.
import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "@/lib/db/client";
import { activity, company, contact, deal, user } from "@/lib/db/schema";
import { LOGGABLE_KINDS, type ActivityKind } from "@/lib/activity-kinds";

export { ACTIVITY_KINDS, KIND_NAMES, LOGGABLE_KINDS, type ActivityKind } from "@/lib/activity-kinds";

// The one record an activity is about.
export type ActivityTarget = { type: "contact" | "company" | "deal"; id: string };

// An activity as the timeline shows it: who logged it by name, null when that person is no longer in Guildhall.
export type ActivityEntry = { id: string; kind: ActivityKind; body: string; createdAt: Date; who: string | null };

// What the form sends, as typed.
export type ActivityInput = { kind: string; body: string };
export type ActivityErrors = Partial<Record<keyof ActivityInput | "target", string>>;

const GONE: Record<ActivityTarget["type"], string> = {
  contact: "That contact isn't in Guildhall any more, so nothing was logged.",
  company: "That company isn't in Guildhall any more, so nothing was logged.",
  deal: "That deal isn't in Guildhall any more, so nothing was logged.",
};

// Ids come from the URL or a form; anything that isn't a uuid can't be a record, and Postgres would reject it.
const isId = (id: string) => z.uuid().safeParse(id).success;

// Trims the text; a sentence per field the form must explain. Only note, call and meeting can be picked.
export function checkActivity(input: ActivityInput):
  { values: { kind: ActivityKind; body: string }; errors: null } | { values: null; errors: ActivityErrors } {
  const errors: ActivityErrors = {};
  const kind = LOGGABLE_KINDS.find((k) => k === input.kind.trim());
  if (!kind) errors.kind = "Pick note, call or meeting.";
  const body = input.body.trim();
  if (!body) errors.body = "Write what happened.";
  if (!kind || errors.body) return { values: null, errors };
  return { values: { kind, body }, errors: null };
}

const column = { contact: activity.contactId, company: activity.companyId, deal: activity.dealId } as const;
const table = { contact, company, deal } as const;

async function exists(db: Db, target: ActivityTarget): Promise<boolean> {
  if (!isId(target.id)) return false;
  const t = table[target.type];
  const [found] = await db.select({ id: t.id }).from(t).where(eq(t.id, target.id)).limit(1);
  return !!found;
}

type Saved = { id: string; errors: null } | { id: null; errors: ActivityErrors };

// Writes an activity whose kind and text are already known to be good, any kind included (stage changes come from
// moving a deal, not from the form). userId is null when nobody signed in did it.
export async function addActivity(
  db: Db, target: ActivityTarget, userId: string | null, values: { kind: ActivityKind; body: string },
): Promise<Saved> {
  if (!(await exists(db, target))) return { id: null, errors: { target: GONE[target.type] } };
  const on = { contactId: target.type === "contact" ? target.id : null, companyId: target.type === "company" ? target.id : null,
    dealId: target.type === "deal" ? target.id : null };
  const [row] = await db.insert(activity).values({ ...values, userId, ...on }).returning({ id: activity.id });
  return { id: row.id, errors: null };
}

// "Log activity" on a contact, company or deal page.
export async function logActivity(db: Db, target: ActivityTarget, userId: string | null, input: ActivityInput): Promise<Saved> {
  const checked = checkActivity(input);
  if (checked.errors) return { id: null, errors: checked.errors };
  return addActivity(db, target, userId, checked.values);
}

// A record's timeline, newest first.
export async function listActivities(db: Db, target: ActivityTarget): Promise<ActivityEntry[]> {
  if (!isId(target.id)) return [];
  return db.select({ id: activity.id, kind: activity.kind, body: activity.body, createdAt: activity.createdAt, who: user.name })
    .from(activity).leftJoin(user, eq(activity.userId, user.id))
    .where(eq(column[target.type], target.id))
    .orderBy(desc(activity.createdAt), desc(activity.id));
}
