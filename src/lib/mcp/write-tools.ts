// The MCP write tools (I8): small jobs that add or move, never remove. One plain function per tool, taking the
// database and the agent, reusing the pages' rules (last activity, stage-change logging, the Won follow-up) rather than
// copying them. Each checks guildhall:write itself, so the refusal is tested without the endpoint, and answers one
// line saying what changed.
import { asc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "@/lib/db/client";
import { company, contact, deal } from "@/lib/db/schema";
import { logActivity, type ActivityTarget } from "@/lib/activities";
import { normaliseEmail } from "@/lib/access";
import { checkContact, EMPTY_CONTACT } from "@/lib/contacts";
import { moveDealStage } from "@/lib/deals";
import type { DealStage } from "@/lib/deal-stages";
import { findOrAddCompany } from "@/lib/enquiries";

// Who the agent acts as, and whether its token carries guildhall:write.
export type Agent = { userId: string; canChange: boolean };

export const READ_ONLY_REFUSAL = "This agent may only read. Reconnect it and allow changes.";

// `id` is the record added or changed, for the agent to pass back; absent when nothing changed.
export type WriteResult = { ok: true; text: string; id?: string } | { ok: false; text: string };

const refused = (text: string): WriteResult => ({ ok: false, text });
const isId = (id: string) => z.uuid().safeParse(id).success;

export type NewContact = { name: string; email?: string; phone?: string; job_title?: string; company?: string };

// The contact already holding this email, ignoring capitals and spaces (the earliest added if several).
async function emailHolder(db: Db, email: string) {
  const [found] = await db.select({ id: contact.id, name: contact.name }).from(contact)
    .where(sql`lower(trim(${contact.email})) = ${normaliseEmail(email)}`)
    .orderBy(asc(contact.createdAt), asc(contact.id)).limit(1);
  return found ?? null;
}

// add_contact: the company is found by name (any capitals) or added, as an enquiry does. An email another contact
// already has is refused, naming them, so an agent never makes a second copy of someone.
export async function addContact(db: Db, agent: Agent, input: NewContact): Promise<WriteResult> {
  if (!agent.canChange) return refused(READ_ONLY_REFUSAL);
  const checked = checkContact({
    ...EMPTY_CONTACT, name: input.name, email: input.email ?? "", phone: input.phone ?? "", jobTitle: input.job_title ?? "",
  });
  if (checked.errors) return refused(`${Object.values(checked.errors).join(" ")} Nothing was added.`);
  const values = checked.values;
  if (values.email) {
    const holder = await emailHolder(db, values.email);
    if (holder) return refused(`'${holder.name}' (ID ${holder.id}) already has ${values.email}, so nothing was added.`);
  }
  const companyName = input.company?.trim() || null;
  return db.transaction(async (tx) => {
    const firm = companyName ? await findOrAddCompany(tx, companyName) : null;
    const [row] = await tx.insert(contact).values({ ...values, companyId: firm?.id ?? null }).returning({ id: contact.id });
    const at = firm ? ` at '${companyName}'${firm.added ? " (a new company)" : ""}` : "";
    return { ok: true, id: row.id, text: `Added '${values.name}'${at} to contacts. ID ${row.id}.` };
  });
}

export const LOG_KINDS = ["note", "call", "meeting"] as const;
export type LogKind = (typeof LOG_KINDS)[number];

// Which record an ID is, and its name as the pages show it; null for none.
async function findRecord(db: Db, id: string): Promise<(ActivityTarget & { name: string }) | null> {
  if (!isId(id)) return null;
  const [c] = await db.select({ name: contact.name }).from(contact).where(eq(contact.id, id)).limit(1);
  if (c) return { type: "contact", id, name: c.name };
  const [co] = await db.select({ name: company.name }).from(company).where(eq(company.id, id)).limit(1);
  if (co) return { type: "company", id, name: co.name };
  const [d] = await db.select({ name: deal.title }).from(deal).where(eq(deal.id, id)).limit(1);
  if (d) return { type: "deal", id, name: d.name };
  return null;
}

// log_activity: a note, call or meeting on a contact, company or deal, logged as the person who connected the agent.
// Counts as last activity on the deal (or the contact's or company's deals), as one logged on the page does.
export async function logActivityOn(
  db: Db, agent: Agent, input: { record_id: string; kind: LogKind; text: string },
): Promise<WriteResult> {
  if (!agent.canChange) return refused(READ_ONLY_REFUSAL);
  const record = await findRecord(db, input.record_id);
  if (!record) return refused("No contact, company or deal has that ID. Find it with search_contacts or list_pipeline.");
  const saved = await logActivity(db, record, agent.userId, { kind: input.kind, body: input.text });
  if (saved.errors) return refused(`${Object.values(saved.errors).join(" ")} Nothing was logged.`);
  return { ok: true, id: saved.id, text: `Logged a ${input.kind} on the ${record.type} '${record.name}'.` };
}

// move_deal_stage: as dragging it on the board does, so the move is logged on the deal ("Moved from X to Y") and a
// move into Won adds the once-per-deal follow-up task.
export async function moveDeal(
  db: Db, agent: Agent, input: { deal_id: string; stage: DealStage },
): Promise<WriteResult> {
  if (!agent.canChange) return refused(READ_ONLY_REFUSAL);
  const notFound = refused("No deal has that ID. Find it with list_pipeline.");
  if (!isId(input.deal_id)) return notFound;
  const [found] = await db.select({ title: deal.title }).from(deal).where(eq(deal.id, input.deal_id)).limit(1);
  if (!found) return notFound;
  const moved = await moveDealStage(db, input.deal_id, input.stage, agent.userId);
  if (!moved) return notFound; // deleted in between
  if (moved.from === moved.to) return { ok: true, text: `'${found.title}' is already at ${moved.to}, so nothing changed.` };
  return { ok: true, id: input.deal_id, text: `Moved '${found.title}' from ${moved.from} to ${moved.to}.` };
}
