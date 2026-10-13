// The MCP write tools (I8): small jobs that add or move, never remove. One plain function per tool, taking the
// database and the agent, reusing the pages' rules (last activity, stage-change logging, the Won follow-up) rather than
// copying them. Each checks guildhall:write itself, so the refusal is tested without the endpoint, answers one line
// saying what changed, and records that line in the agent log (I8) when something did.
import { asc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "@/lib/db/client";
import { company, contact, deal } from "@/lib/db/schema";
import { logActivity, type ActivityTarget } from "@/lib/activities";
import { recordAgentChange, type LoggedAgent, type LoggedRecord } from "@/lib/agent-log";
import { normaliseEmail } from "@/lib/access";
import { checkContact, EMPTY_CONTACT } from "@/lib/contacts";
import { addDays, TIME_ZONE, todayIn } from "@/lib/dates";
import { moveDealStage } from "@/lib/deals";
import type { DealStage } from "@/lib/deal-stages";
import { findOrAddCompany } from "@/lib/enquiries";
import { createInvoice, formatInvoiceNumber, getInvoice, PAYMENT_DAYS, type InvoiceErrors } from "@/lib/invoices";
import { formatMoney } from "@/lib/money";
import { invoicePage } from "./read-tools";

// The agent (its client ID and name, for the log), who it acts as, and whether its token carries guildhall:write.
export type Agent = LoggedAgent & { userId: string; canChange: boolean };

export const READ_ONLY_REFUSAL = "This agent may only read. Reconnect it and allow changes.";

// `id` is the record added or changed, for the agent to pass back; absent when nothing changed.
export type WriteResult = { ok: true; text: string; id?: string } | { ok: false; text: string };

const refused = (text: string): WriteResult => ({ ok: false, text });

// A change made: recorded in the agent log against the record it touched, then answered. `forAgent` is said after the
// summary to the agent only, as the log page never shows an ID.
async function changed(
  db: Db, agent: Agent, change: { tool: string; touched: LoggedRecord; summary: string; id: string; forAgent?: string },
): Promise<WriteResult> {
  await recordAgentChange(db, agent, { userId: agent.userId, tool: change.tool, summary: change.summary, touched: change.touched });
  return { ok: true, id: change.id, text: change.forAgent ? `${change.summary} ${change.forAgent}` : change.summary };
}
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
    return changed(tx, agent, {
      tool: "add_contact", touched: { type: "contact", id: row.id }, summary: `Added '${values.name}'${at} to contacts.`,
      id: row.id, forAgent: `ID ${row.id}.`,
    });
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
  return changed(db, agent, {
    tool: "log_activity", touched: { type: record.type, id: record.id },
    summary: `Logged a ${input.kind} on the ${record.type} '${record.name}'.`, id: saved.id,
  });
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
  return changed(db, agent, {
    tool: "move_deal_stage", touched: { type: "deal", id: input.deal_id },
    summary: `Moved '${found.title}' from ${moved.from} to ${moved.to}.`, id: input.deal_id,
  });
}

export type DraftLine = { description: string; quantity: string | number; unit_price: string | number };
export type NewInvoiceDraft = { client_id: string; project_id?: string; lines: DraftLine[]; due_date?: string };

// The form's sentences, with the line each is about, as one answer.
function invoiceProblems(errors: InvoiceErrors): string {
  const said = Object.entries(errors).filter(([key]) => key !== "line").map(([, text]) => text as string);
  for (const [n, line] of Object.entries(errors.line ?? {})) {
    said.push(...Object.values(line).map((text) => `Line ${Number(n) + 1}: ${text}`));
  }
  return said.join(" ");
}

// create_invoice_draft: a Draft, through the same rules as the New invoice form, issued today with PAYMENT_DAYS to pay
// unless a due date is given. It has no way to mark anything Sent or Paid: the owner checks the Draft and sends it.
// `appUrl` is the app's origin, for the invoice page's address.
export async function createInvoiceDraft(
  db: Db, agent: Agent, input: NewInvoiceDraft, appUrl: string, now = new Date(),
): Promise<WriteResult> {
  if (!agent.canChange) return refused(READ_ONLY_REFUSAL);
  const issueOn = todayIn(TIME_ZONE, now);
  const saved = await createInvoice(db, {
    clientId: input.client_id, projectId: input.project_id ?? "", issueOn,
    dueOn: input.due_date ?? addDays(issueOn, PAYMENT_DAYS),
    lines: input.lines.map((l) => ({ description: l.description, quantity: String(l.quantity), unitPrice: String(l.unit_price) })),
  });
  if (saved.errors) {
    const clientHelp = saved.errors.clientId ? " Find the client's ID with list_clients." : "";
    const projectHelp = saved.errors.projectId ? " Find its projects with list_projects." : "";
    return refused(`${invoiceProblems(saved.errors)}${clientHelp}${projectHelp} Nothing was made.`);
  }
  const made = (await getInvoice(db, saved.id))!;
  const number = formatInvoiceNumber(made.number);
  const { subtotal, tax, total } = made.totals;
  return changed(db, agent, {
    tool: "create_invoice_draft", touched: { type: "invoice", id: made.id },
    summary: `Drafted ${number} for '${made.clientName}': ${formatMoney(subtotal)} plus ${formatMoney(tax)} tax, ${formatMoney(total)} in all, due ${made.dueOn}.`,
    id: made.id,
    forAgent: `It is a Draft: the owner checks it and sends it at ${invoicePage(appUrl, made.id)}. ID ${made.id}.`,
  });
}
