// Invoices (I11): bills to a client, optionally for one of its projects. Plain functions on `db`, so the pages, the
// PDF and later the agent's tools (get_invoice, create_invoice_draft) share one set of rules: numbers from a sequence,
// the tax rate copied on when made, Draft to Sent to Paid, and only a Draft edited or deleted.
import { and, asc, desc, eq, getTableColumns, inArray, sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "@/lib/db/client";
import { clientName } from "@/lib/clients";
import { isDay } from "@/lib/dates";
import { client, company, contact, invoice, invoiceLine, project, type InvoiceStatus } from "@/lib/db/schema";
import { invoiceTotals, parseQuantity, type InvoiceTotals } from "@/lib/invoice-totals";
import { parseMoney } from "@/lib/money";
import { getTaxRate } from "@/lib/settings";

export { INVOICE_STATUSES, type InvoiceStatus } from "@/lib/db/schema";

// Ids come from the URL or a form; anything that isn't a uuid can't be a record, and Postgres would reject it.
const isId = (id: string) => z.uuid().safeParse(id).success;

// 1 reads "INV-0001"; past 9999 the number just grows.
export function formatInvoiceNumber(n: number): string {
  return `INV-${String(n).padStart(4, "0")}`;
}

// The PDF saves as "INV-0001.pdf": the number the client quotes back is the name they file it under.
export function invoicePdfFileName(n: number): string {
  return `${formatInvoiceNumber(n)}.pdf`;
}

// Overdue: sent, not paid, and its due day has gone by. A Draft isn't owed yet; a Paid one isn't owed at all. Both
// days are YYYY-MM-DD, which compare correctly as text.
export function isOverdue(i: { status: InvoiceStatus; dueOn: string }, today: string): boolean {
  return i.status === "Sent" && i.dueOn < today;
}

// The one step each status can take: "Mark sent" on a Draft, "Mark paid" on a Sent one.
export const NEXT_STATUS: Record<InvoiceStatus, InvoiceStatus | null> = { Draft: "Sent", Sent: "Paid", Paid: null };

// What the form sends: every field as typed. Dates are "" or YYYY-MM-DD; projectId is "" for none.
export type LineInput = { description: string; quantity: string; unitPrice: string };
export type InvoiceInput = { clientId: string; projectId: string; issueOn: string; dueOn: string; lines: LineInput[] };
export type LineErrors = Partial<Record<keyof LineInput, string>>;
export type InvoiceErrors = Partial<Record<"clientId" | "projectId" | "issueOn" | "dueOn" | "lines" | "form", string>>
  & { line?: Record<number, LineErrors> };

type LineValues = LineInput;
type InvoiceValues = { clientId: string; projectId: string | null; issueOn: string; dueOn: string; lines: LineValues[] };

export const MAX_LINES = 50;
// Two lines on the PDF, so 15 lines still fit one A4 page.
export const MAX_DESCRIPTION = 100;
export const PICK_CLIENT = "Pick a client.";
export const NOT_THEIR_PROJECT = "Pick one of this client's projects, or no project.";
export const DUE_BEFORE_ISSUE = "The due date can't be before the issue date.";
export const NO_LINES = "Add at least one line: a description, a quantity and a unit price.";
export const NOT_DRAFT = "Only a Draft can be changed. This invoice has been sent.";

const blankLine = (l: LineInput) => !l.description.trim() && !l.quantity.trim() && !l.unitPrice.trim();

// Trims each field and turns figures into their stored form; a sentence per field the form must explain. A line left
// entirely blank is dropped, so the form can offer spare rows. Error indexes count the lines as they were sent.
export function checkInvoice(input: InvoiceInput): { values: InvoiceValues; errors: null } | { values: null; errors: InvoiceErrors } {
  const errors: InvoiceErrors = {};
  const clientId = input.clientId.trim();
  if (!isId(clientId)) errors.clientId = PICK_CLIENT;
  const projectId = input.projectId.trim() || null;
  if (projectId && !isId(projectId)) errors.projectId = NOT_THEIR_PROJECT;

  const issueOn = input.issueOn.trim();
  if (!issueOn) errors.issueOn = "Enter the issue date.";
  else if (!isDay(issueOn)) errors.issueOn = "Enter a date, like 12 Oct 2026.";
  const dueOn = input.dueOn.trim();
  if (!dueOn) errors.dueOn = "Enter the due date.";
  else if (!isDay(dueOn)) errors.dueOn = "Enter a date, like 12 Oct 2026.";
  else if (!errors.issueOn && dueOn < issueOn) errors.dueOn = DUE_BEFORE_ISSUE;

  const lines: LineValues[] = [];
  const line: Record<number, LineErrors> = {};
  input.lines.forEach((l, i) => {
    if (blankLine(l)) return;
    const e: LineErrors = {};
    const description = l.description.trim();
    if (!description) e.description = "Enter what this line is for.";
    else if (description.length > MAX_DESCRIPTION) {
      e.description = `Keep the description to ${MAX_DESCRIPTION} characters or fewer; it has ${description.length}.`;
    }
    const quantity = parseQuantity(l.quantity);
    if (quantity.error) e.quantity = quantity.error;
    const price = l.unitPrice.trim() ? parseMoney(l.unitPrice) : { value: null, error: "Enter a unit price, like 85.00." };
    if (price.error) e.unitPrice = price.error;
    if (Object.keys(e).length > 0) line[i] = e;
    else lines.push({ description, quantity: quantity.value!, unitPrice: price.value! });
  });
  if (Object.keys(line).length > 0) errors.line = line;
  else if (lines.length === 0) errors.lines = NO_LINES;
  else if (lines.length > MAX_LINES) errors.lines = `An invoice holds at most ${MAX_LINES} lines. Split the work over two invoices.`;

  if (Object.keys(errors).length > 0) return { values: null, errors };
  return { values: { clientId, projectId, issueOn, dueOn, lines }, errors: null };
}

// The client must exist and the project, if any, be one of its own (a tampered form, or a project moved meanwhile).
async function checkOwners(db: Db, v: InvoiceValues): Promise<InvoiceErrors | null> {
  const [found] = await db.select({ id: client.id }).from(client).where(eq(client.id, v.clientId)).limit(1);
  if (!found) return { clientId: PICK_CLIENT };
  if (v.projectId) {
    const [p] = await db.select({ id: project.id }).from(project)
      .where(and(eq(project.id, v.projectId), eq(project.clientId, v.clientId))).limit(1);
    if (!p) return { projectId: NOT_THEIR_PROJECT };
  }
  return null;
}

const lineRows = (invoiceId: string, lines: LineValues[]) => lines.map((l, position) => ({ invoiceId, position, ...l }));

type Saved = { id: string; number: number; errors: null } | { id: null; number: null; errors: InvoiceErrors };

// A new invoice is a Draft, with the business's tax rate as it is now and the next number.
export async function createInvoice(db: Db, input: InvoiceInput): Promise<Saved> {
  const checked = checkInvoice(input);
  if (checked.errors) return { id: null, number: null, errors: checked.errors };
  const owners = await checkOwners(db, checked.values);
  if (owners) return { id: null, number: null, errors: owners };
  const taxRate = await getTaxRate(db);
  const { lines, ...fields } = checked.values;
  return db.transaction(async (t) => {
    const tx = t as unknown as Db;
    const [row] = await tx.insert(invoice).values({ ...fields, taxRate }).returning({ id: invoice.id, number: invoice.number });
    await tx.insert(invoiceLine).values(lineRows(row.id, lines));
    return { id: row.id, number: row.number, errors: null };
  });
}

// Only a Draft, and it keeps its number, status and tax rate. null when there is no such invoice (deleted in another
// tab, or a tampered id).
export async function updateInvoice(db: Db, id: string, input: InvoiceInput, now = new Date()): Promise<Saved | null> {
  if (!isId(id)) return null;
  const current = await statusOf(db, id);
  if (!current) return null;
  if (current.status !== "Draft") return { id: null, number: null, errors: { form: NOT_DRAFT } };
  const checked = checkInvoice(input);
  if (checked.errors) return { id: null, number: null, errors: checked.errors };
  const owners = await checkOwners(db, checked.values);
  if (owners) return { id: null, number: null, errors: owners };
  const { lines, ...fields } = checked.values;
  return db.transaction(async (t) => {
    const tx = t as unknown as Db;
    // still a Draft: sent in another tab since it was read, it stays as sent
    const saved = await tx.update(invoice).set({ ...fields, updatedAt: now })
      .where(and(eq(invoice.id, id), eq(invoice.status, "Draft"))).returning({ number: invoice.number });
    if (saved.length === 0) return { id: null, number: null, errors: { form: NOT_DRAFT } };
    await tx.delete(invoiceLine).where(eq(invoiceLine.invoiceId, id));
    await tx.insert(invoiceLine).values(lineRows(id, lines));
    return { id, number: saved[0].number, errors: null };
  });
}

async function statusOf(db: Db, id: string): Promise<{ status: InvoiceStatus } | null> {
  const [found] = await db.select({ status: invoice.status }).from(invoice).where(eq(invoice.id, id)).limit(1);
  return found ?? null;
}

// "Mark sent" (Draft to Sent) and "Mark paid" (Sent to Paid): one step forward, never back. The step is checked in the
// update itself, so a page left open can't mark a Draft paid or a Paid one sent. false when it isn't that step.
export async function advanceInvoice(db: Db, id: string, to: string, now = new Date()): Promise<boolean> {
  const from = (Object.keys(NEXT_STATUS) as InvoiceStatus[]).find((s) => NEXT_STATUS[s] === to);
  if (!from || !isId(id)) return false;
  const moved = await db.update(invoice).set({ status: NEXT_STATUS[from]!, updatedAt: now })
    .where(and(eq(invoice.id, id), eq(invoice.status, from))).returning({ id: invoice.id });
  return moved.length > 0;
}

// Only a Draft; its lines go with it. Its number is never given out again. false when there is no such Draft.
export async function deleteInvoice(db: Db, id: string): Promise<boolean> {
  if (!isId(id)) return false;
  const gone = await db.delete(invoice).where(and(eq(invoice.id, id), eq(invoice.status, "Draft"))).returning({ id: invoice.id });
  return gone.length > 0;
}

export type Invoice = typeof invoice.$inferSelect;
export type InvoiceLine = { description: string; quantity: string; unitPrice: string };
// An invoice as the pages show it: its client's current name, its project's name, its lines and its totals.
export type InvoiceRow = Invoice & { clientName: string; projectName: string | null; totals: InvoiceTotals };
export type InvoiceDetails = InvoiceRow & { lines: InvoiceLine[] };

const withNames = { ...getTableColumns(invoice), clientName, projectName: project.name };

function selectInvoices(db: Db, where?: SQL) {
  return db.select(withNames).from(invoice)
    .innerJoin(client, eq(invoice.clientId, client.id))
    .leftJoin(company, eq(client.companyId, company.id))
    .leftJoin(contact, eq(client.contactId, contact.id))
    .leftJoin(project, eq(invoice.projectId, project.id))
    .where(where);
}

// Each invoice's lines in order, keyed by invoice.
async function linesOf(db: Db, ids: string[]): Promise<Map<string, InvoiceLine[]>> {
  const byInvoice = new Map<string, InvoiceLine[]>(ids.map((id) => [id, []]));
  if (ids.length === 0) return byInvoice;
  const rows = await db.select({ invoiceId: invoiceLine.invoiceId, description: invoiceLine.description, quantity: invoiceLine.quantity, unitPrice: invoiceLine.unitPrice })
    .from(invoiceLine).where(inArray(invoiceLine.invoiceId, ids)).orderBy(asc(invoiceLine.invoiceId), asc(invoiceLine.position));
  for (const { invoiceId, ...l } of rows) byInvoice.get(invoiceId)!.push(l);
  return byInvoice;
}

// Newest number first. Filtered to one client's or one project's invoices when asked.
export async function listInvoices(db: Db, filter: { clientId?: string; projectId?: string } = {}): Promise<InvoiceRow[]> {
  if ((filter.clientId !== undefined && !isId(filter.clientId)) || (filter.projectId !== undefined && !isId(filter.projectId))) return [];
  const where = and(
    filter.clientId ? eq(invoice.clientId, filter.clientId) : undefined,
    filter.projectId ? eq(invoice.projectId, filter.projectId) : undefined,
  );
  const rows = await selectInvoices(db, where).orderBy(desc(invoice.number));
  const lines = await linesOf(db, rows.map((r) => r.id));
  return rows.map((r) => ({ ...r, totals: invoiceTotals(lines.get(r.id)!, r.taxRate) }));
}

export async function getInvoice(db: Db, id: string): Promise<InvoiceDetails | null> {
  if (!isId(id)) return null;
  const [found] = await selectInvoices(db, eq(invoice.id, id)).limit(1);
  if (!found) return null;
  const lines = (await linesOf(db, [id])).get(id)!;
  return { ...found, lines, totals: invoiceTotals(lines, found.taxRate) };
}

// Every project, with its client, for the form's project picker (which shows only the picked client's). A to Z, ties
// by id, so the order is the same on every load.
export async function listProjectChoices(db: Db): Promise<{ id: string; name: string; clientId: string }[]> {
  return db.select({ id: project.id, name: project.name, clientId: project.clientId }).from(project)
    .orderBy(sql`lower(${project.name})`, asc(project.id));
}
