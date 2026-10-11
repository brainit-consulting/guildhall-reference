// Deals (B9): work the business hopes to win. Plain functions on `db`, so the pages and later the pipeline, the
// dashboard and the MCP tools (get_deal, list_pipeline) share one set of rules.
import { and, asc, count, desc, eq, getTableColumns, ilike, inArray, or, sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "@/lib/db/client";
import { addActivity } from "@/lib/activities";
import { isDay } from "@/lib/dates";
import { company, contact, deal } from "@/lib/db/schema";
import { DEAL_STAGES, OPEN_STAGES, type DealStage } from "@/lib/deal-stages";
import { likePattern, readListView, type ListView, type SearchParams } from "@/lib/list-view";
import { parseMoney } from "@/lib/money";

export type Deal = typeof deal.$inferSelect;
// A deal as the pages show it: with its contact's and company's names, null when it has none.
export type DealWithNames = Deal & { contactName: string | null; companyName: string | null };

export { DEAL_STAGES, isOpen, OPEN_STAGES, type DealStage } from "@/lib/deal-stages";

// What the form sends: every field as typed. contactId and companyId are "" for none; expectedClose is "" or
// YYYY-MM-DD, as a date field sends it.
export type DealInput = { title: string; value: string; stage: string; contactId: string; companyId: string; expectedClose: string };
export type DealValues = {
  title: string; value: string | null; stage: DealStage; contactId: string | null; companyId: string | null; expectedClose: string | null;
};
export type DealErrors = Partial<Record<keyof DealInput, string>>;

export const EMPTY_DEAL: DealInput = { title: "", value: "", stage: "New", contactId: "", companyId: "", expectedClose: "" };

const CONTACT_GONE = "That contact isn't in Guildhall any more. Pick another, or No contact.";
const COMPANY_GONE = "That company isn't in Guildhall any more. Pick another, or No company.";

const orNull = (s: string) => s.trim() || null;

// Ids come from the URL or a form; anything that isn't a uuid can't be a record, and Postgres would reject it.
const isId = (id: string) => z.uuid().safeParse(id).success;

// Trims each field, turns blanks into null and money into "1234.50"; a sentence per field the form must explain.
export function checkDeal(input: DealInput): { values: DealValues; errors: null } | { values: null; errors: DealErrors } {
  const errors: DealErrors = {};
  const title = input.title.trim();
  if (!title) errors.title = "Enter a title.";

  let value: string | null = null;
  if (input.value.trim()) {
    const money = parseMoney(input.value);
    if (money.error) errors.value = money.error;
    else value = money.value;
  }

  // the form only offers the five stages; anything else came from a tampered form
  const stage = DEAL_STAGES.find((s) => s === input.stage.trim());
  if (!stage) errors.stage = "Pick a stage: New, Contacted, Proposal, Won or Lost.";

  const contactId = orNull(input.contactId);
  if (contactId && !isId(contactId)) errors.contactId = CONTACT_GONE;
  const companyId = orNull(input.companyId);
  if (companyId && !isId(companyId)) errors.companyId = COMPANY_GONE;

  const expectedClose = orNull(input.expectedClose);
  if (expectedClose && !isDay(expectedClose)) errors.expectedClose = "Enter a date, like 12 Oct 2026.";

  if (Object.keys(errors).length > 0 || !stage) return { values: null, errors };
  return { values: { title, value, stage, contactId, companyId, expectedClose }, errors: null };
}

const withNames = { ...getTableColumns(deal), contactName: contact.name, companyName: company.name };

function selectDeals(db: Db) {
  return db.select(withNames).from(deal)
    .leftJoin(contact, eq(deal.contactId, contact.id))
    .leftJoin(company, eq(deal.companyId, company.id));
}

// The columns the Deals list can sort by, as they appear in the address (`?sort=value`).
export const DEAL_SORTS = ["title", "company", "value", "stage", "close", "activity"] as const;
export type DealSort = (typeof DEAL_SORTS)[number];
// The list view plus the Deals filters: one stage (`stage=Proposal`) and open deals only (`open=1`).
export type DealView = ListView<DealSort> & { stage: DealStage | null; open: boolean };

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

// An unknown stage, or `open` set to anything but 1, is ignored, like any other junk in the address.
export function readDealView(params: SearchParams): DealView {
  const stage = DEAL_STAGES.find((s) => s === one(params.stage)) ?? null;
  return { ...readListView(params, DEAL_SORTS), stage, open: one(params.open) === "1" };
}

// The one where-clause for the table and the open total, so the two can't disagree. A search matches the title, the
// company's name, or the contact's name or email, any capitals. Stage Won with open only matches nothing.
function dealWhere(view: DealView): SQL | undefined {
  const pattern = view.q ? likePattern(view.q) : null;
  return and(
    pattern ? or(ilike(deal.title, pattern), ilike(company.name, pattern), ilike(contact.name, pattern), ilike(contact.email, pattern)) : undefined,
    view.stage ? eq(deal.stage, view.stage) : undefined,
    view.open ? inArray(deal.stage, [...OPEN_STAGES]) : undefined,
  );
}

// Text ignores capitals; value sorts as numeric, dates as dates; stage is a Postgres enum, which sorts in the order
// it was declared (New, Contacted, Proposal, Won, Lost).
const SORT_BY = {
  title: sql`lower(${deal.title})`,
  company: sql`lower(${company.name})`,
  value: sql`${deal.value}`,
  stage: sql`${deal.stage}`,
  close: sql`${deal.expectedClose}`,
  activity: sql`${deal.lastActivityAt}`,
} as const;

// With no view (or no sort), newest added first, as the pipeline board expects. A sort puts blanks last both ways;
// ties go by title, then id, so the order is the same on every load.
export async function listDeals(db: Db, view?: DealView): Promise<DealWithNames[]> {
  const query = selectDeals(db).where(view && dealWhere(view));
  if (!view?.sort) return query.orderBy(desc(deal.createdAt), desc(deal.id));
  return query.orderBy(sql`${SORT_BY[view.sort]} ${sql.raw(view.dir === "desc" ? "desc" : "asc")} nulls last`,
    sql`lower(${deal.title})`, asc(deal.id));
}

export async function getDeal(db: Db, id: string): Promise<DealWithNames | null> {
  if (!isId(id)) return null;
  const [found] = await selectDeals(db).where(eq(deal.id, id)).limit(1);
  return found ?? null;
}

// How many deals are open and what they are worth. Postgres adds the numerics, so the total is exact; deals with no
// value count towards the number but add nothing. Given the list's view, only the open deals the table shows count.
export async function openDealsTotal(db: Db, view?: DealView): Promise<{ count: number; total: string }> {
  const [row] = await db.select({ count: count(), total: sql<string>`coalesce(sum(${deal.value}), 0)::text` })
    .from(deal)
    .leftJoin(contact, eq(deal.contactId, contact.id))
    .leftJoin(company, eq(deal.companyId, company.id))
    .where(and(inArray(deal.stage, [...OPEN_STAGES]), view && dealWhere(view)));
  return { count: row.count, total: row.total };
}

// The contact or company may have been deleted while the form was open; say so rather than fail on the foreign key.
async function linksGone(db: Db, values: DealValues): Promise<DealErrors | null> {
  const errors: DealErrors = {};
  if (values.contactId) {
    const [found] = await db.select({ id: contact.id }).from(contact).where(eq(contact.id, values.contactId)).limit(1);
    if (!found) errors.contactId = CONTACT_GONE;
  }
  if (values.companyId) {
    const [found] = await db.select({ id: company.id }).from(company).where(eq(company.id, values.companyId)).limit(1);
    if (!found) errors.companyId = COMPANY_GONE;
  }
  return Object.keys(errors).length > 0 ? errors : null;
}

type Saved = { id: string; errors: null } | { id: null; errors: DealErrors };

export async function createDeal(db: Db, input: DealInput): Promise<Saved> {
  const checked = checkDeal(input);
  if (checked.errors) return { id: null, errors: checked.errors };
  const gone = await linksGone(db, checked.values);
  if (gone) return { id: null, errors: gone };
  const [row] = await db.insert(deal).values(checked.values).returning({ id: deal.id });
  return { id: row.id, errors: null };
}

// "Moved from Contacted to Proposal": what a stage change says on the deal's timeline (B11).
export function stageChangeText(from: DealStage, to: DealStage): string {
  return `Moved from ${from} to ${to}`;
}

// Sets a deal's fields and returns the stage it had, read by the same statement under a row lock, so two people
// moving one deal at once each log the move they actually made. null when the deal isn't there.
async function setDeal(db: Db, id: string, values: Partial<DealValues>): Promise<DealStage | null> {
  const old = db.select({ id: deal.id, stage: deal.stage }).from(deal).where(eq(deal.id, id)).for("update").as("old");
  const [row] = await db.update(deal).set({ ...values, updatedAt: new Date() })
    .from(old).where(eq(deal.id, old.id)).returning({ from: old.stage });
  return row?.from ?? null;
}

// Every stage change, from the board, the form or later the MCP tools, is logged on the deal by who made it (null
// when nobody signed in did). Also counts as the deal's last activity, like any activity on it.
async function logStageChange(db: Db, id: string, userId: string | null, from: DealStage, to: DealStage) {
  if (from === to) return;
  await addActivity(db, { type: "deal", id }, userId, { kind: "stage_change", body: stageChangeText(from, to) });
}

// null when there is no such deal (deleted in another tab, or a tampered id).
export async function updateDeal(db: Db, id: string, input: DealInput, userId: string | null): Promise<Saved | null> {
  if (!isId(id)) return null;
  const checked = checkDeal(input);
  if (checked.errors) return { id: null, errors: checked.errors };
  const gone = await linksGone(db, checked.values);
  if (gone) return { id: null, errors: gone };
  const from = await setDeal(db, id, checked.values);
  if (!from) return null;
  await logStageChange(db, id, userId, from, checked.values.stage);
  return { id, errors: null };
}

// Moves a deal to another stage (the pipeline board; later the MCP move_deal_stage tool) and logs the move. Returns
// the stage it left and the one it reached; null for no such deal or no such stage. Moving to the stage it is already
// in changes and logs nothing.
export async function moveDealStage(
  db: Db, id: string, stage: string, userId: string | null,
): Promise<{ from: DealStage; to: DealStage } | null> {
  const to = DEAL_STAGES.find((s) => s === stage);
  if (!to || !isId(id)) return null;
  const [found] = await db.select({ stage: deal.stage }).from(deal).where(eq(deal.id, id)).limit(1);
  if (!found) return null;
  if (found.stage === to) return { from: to, to };
  const from = await setDeal(db, id, { stage: to });
  if (!from) return null; // deleted in between
  await logStageChange(db, id, userId, from, to);
  return { from, to };
}

export async function deleteDeal(db: Db, id: string): Promise<boolean> {
  if (!isId(id)) return false;
  const gone = await db.delete(deal).where(eq(deal.id, id)).returning({ id: deal.id });
  return gone.length > 0;
}
