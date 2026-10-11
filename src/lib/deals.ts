// Deals (B9): work the business hopes to win. Plain functions on `db`, so the pages and later the pipeline, the
// dashboard and the MCP tools (get_deal, list_pipeline) share one set of rules.
import { and, asc, count, desc, eq, getTableColumns, gte, ilike, inArray, lt, or, sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "@/lib/db/client";
import { addActivity } from "@/lib/activities";
import { coldBefore } from "@/lib/cold";
import { isDay, isMonth, nextMonthStart, TIME_ZONE, todayIn } from "@/lib/dates";
import { company, contact, deal } from "@/lib/db/schema";
import { DEAL_STAGES, OPEN_STAGES, type DealStage } from "@/lib/deal-stages";
import { likePattern, readListView, type ListView, type SearchParams } from "@/lib/list-view";
import { parseMoney } from "@/lib/money";
import { addWonFollowUp } from "@/lib/won-follow-up";

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
// The list view plus the Deals filters: one stage (`stage=Proposal`), open deals only (`open=1`), deals going cold
// (`cold=1`, which implies open) and the deals won in a month (`won=2026-10`, Home's "Won this month"; only the
// address sets it, there is no control for it).
export type DealView = ListView<DealSort> & { stage: DealStage | null; open: boolean; cold: boolean; won: string | null };

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

// An unknown stage, `open` or `cold` set to anything but 1, or a `won` that isn't a real month is ignored, like any
// other junk in the address.
export function readDealView(params: SearchParams): DealView {
  const stage = DEAL_STAGES.find((s) => s === one(params.stage)) ?? null;
  const won = one(params.won);
  return {
    ...readListView(params, DEAL_SORTS), stage, open: one(params.open) === "1", cold: one(params.cold) === "1",
    won: isMonth(won) ? won : null,
  };
}

// isCold (src/lib/cold.ts) as a where-clause: open, and last touched (or added, when nothing was ever logged) before
// the business's day `today - 13` began. The instant goes in as UTC text cast to timestamp, the way the columns hold
// it, so no driver's handling of a Date can shift it.
function coldWhere(now: Date): SQL | undefined {
  return and(inArray(deal.stage, [...OPEN_STAGES]),
    sql`coalesce(${deal.lastActivityAt}, ${deal.createdAt}) < ${coldBefore(now).toISOString()}::timestamp`);
}

// Won in a month (YYYY-MM): on or after its 1st and before the next month's, so the index on won_on serves it.
function wonIn(month: string): SQL | undefined {
  return and(gte(deal.wonOn, `${month}-01`), lt(deal.wonOn, nextMonthStart(month)));
}

// The one where-clause for the table and its figures, so they can't disagree. A search matches the title, the
// company's name, or the contact's name or email, any capitals. Stage Won with open only matches nothing.
function dealWhere(view: DealView, now: Date): SQL | undefined {
  const pattern = view.q ? likePattern(view.q) : null;
  return and(
    pattern ? or(ilike(deal.title, pattern), ilike(company.name, pattern), ilike(contact.name, pattern), ilike(contact.email, pattern)) : undefined,
    view.stage ? eq(deal.stage, view.stage) : undefined,
    view.open ? inArray(deal.stage, [...OPEN_STAGES]) : undefined,
    view.cold ? coldWhere(now) : undefined,
    view.won ? wonIn(view.won) : undefined,
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
// ties go by title, then id, so the order is the same on every load. `now` decides which deals are going cold; pass the
// one the page marks them with.
export async function listDeals(db: Db, view?: DealView, now = new Date()): Promise<DealWithNames[]> {
  const query = selectDeals(db).where(view && dealWhere(view, now));
  if (!view?.sort) return query.orderBy(desc(deal.createdAt), desc(deal.id));
  return query.orderBy(sql`${SORT_BY[view.sort]} ${sql.raw(view.dir === "desc" ? "desc" : "asc")} nulls last`,
    sql`lower(${deal.title})`, asc(deal.id));
}

export async function getDeal(db: Db, id: string): Promise<DealWithNames | null> {
  if (!isId(id)) return null;
  const [found] = await selectDeals(db).where(eq(deal.id, id)).limit(1);
  return found ?? null;
}

export type DealsTotal = { count: number; total: string };

// How many deals match and what they are worth. Postgres adds the numerics, so the total is exact; deals with no value
// count towards the number but add nothing. Joined as the list is, so the list's where-clause works here.
async function dealsTotal(db: Db, where: SQL | undefined): Promise<DealsTotal> {
  const [row] = await db.select({ count: count(), total: sql<string>`coalesce(sum(${deal.value}), 0)::text` })
    .from(deal)
    .leftJoin(contact, eq(deal.contactId, contact.id))
    .leftJoin(company, eq(deal.companyId, company.id))
    .where(where);
  return { count: row.count, total: row.total };
}

// How many deals are open and what they are worth. Given the list's view, only the open deals the table shows count.
// `now` decides which deals are going cold; pass the one the list was read with.
export async function openDealsTotal(db: Db, view?: DealView, now = new Date()): Promise<DealsTotal> {
  return dealsTotal(db, and(inArray(deal.stage, [...OPEN_STAGES]), view && dealWhere(view, now)));
}

// Every deal the list shows, whatever its stage: the figures when the list is the deals won in a month.
export async function listedDealsTotal(db: Db, view: DealView, now = new Date()): Promise<DealsTotal> {
  return dealsTotal(db, dealWhere(view, now));
}

// The open deals going cold at `now`, with their company's name and value, longest quiet first (ties by title, then
// id). Home counts and lists these; the Deals list's `cold=1` uses the same where-clause.
export async function coldDeals(db: Db, now = new Date(), limit?: number): Promise<DealWithNames[]> {
  const query = selectDeals(db).where(coldWhere(now))
    .orderBy(sql`coalesce(${deal.lastActivityAt}, ${deal.createdAt}) asc`, sql`lower(${deal.title})`, asc(deal.id));
  return limit === undefined ? query : query.limit(limit);
}

// How many of coldDeals Home lists; coldDealsTotal gives the "All 14 going cold" beneath them.
export const HOME_COLD_LIMIT = 10;

// How many deals are going cold at `now` and what they are worth: Home's "Going cold", the figures /deals?cold=1 shows.
export async function coldDealsTotal(db: Db, now = new Date()): Promise<DealsTotal> {
  return dealsTotal(db, coldWhere(now));
}

// How many deals sit at each stage, every stage present (0 for one with none): Home's row of stages. One grouped
// query; each count is the rows /deals?stage=<Stage> lists.
export async function dealsPerStage(db: Db): Promise<Record<DealStage, number>> {
  const rows = await db.select({ stage: deal.stage, count: count() }).from(deal).groupBy(deal.stage);
  const counts = Object.fromEntries(DEAL_STAGES.map((s) => [s, 0])) as Record<DealStage, number>;
  for (const r of rows) counts[r.stage] = r.count;
  return counts;
}

// How many deals were won in a month (YYYY-MM) and what they are worth: Home's "Won this month". A deal won and then
// moved out of Won has no won_on, so it no longer counts.
export async function wonInMonth(db: Db, month: string): Promise<DealsTotal> {
  if (!isMonth(month)) return { count: 0, total: "0" };
  return dealsTotal(db, wonIn(month));
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

// `now` decides the business's day a deal added at Won was won; tests pass it, the app lets it default.
export async function createDeal(db: Db, input: DealInput, now = new Date()): Promise<Saved> {
  const checked = checkDeal(input);
  if (checked.errors) return { id: null, errors: checked.errors };
  const gone = await linksGone(db, checked.values);
  if (gone) return { id: null, errors: gone };
  const wonOn = checked.values.stage === "Won" ? todayIn(TIME_ZONE, now) : null;
  const [row] = await db.insert(deal).values({ ...checked.values, wonOn }).returning({ id: deal.id });
  if (wonOn) await addWonFollowUp(db, row.id);
  return { id: row.id, errors: null };
}

// "Moved from Contacted to Proposal": what a stage change says on the deal's timeline (B11).
export function stageChangeText(from: DealStage, to: DealStage): string {
  return `Moved from ${from} to ${to}`;
}

// Sets a deal's fields and returns the stage it had, read by the same statement under a row lock, so two people
// moving one deal at once each log the move they actually made. null when the deal isn't there.
// Every stage change passes here, so here a deal learns the day it was won (the business's today at `now`): kept when
// it is saved at Won again, cleared when it leaves Won.
async function setDeal(db: Db, id: string, values: Partial<DealValues>, now: Date): Promise<DealStage | null> {
  const won = values.stage === undefined ? {}
    : { wonOn: values.stage === "Won" ? sql`coalesce(${deal.wonOn}, ${todayIn(TIME_ZONE, now)}::date)` : null };
  const old = db.select({ id: deal.id, stage: deal.stage }).from(deal).where(eq(deal.id, id)).for("update").as("old");
  const [row] = await db.update(deal).set({ ...values, ...won, updatedAt: now })
    .from(old).where(eq(deal.id, old.id)).returning({ from: old.stage });
  return row?.from ?? null;
}

// Every stage change, from the board, the form or later the MCP tools, is logged on the deal by who made it (null
// when nobody signed in did). Also counts as the deal's last activity, like any activity on it.
async function logStageChange(db: Db, id: string, userId: string | null, from: DealStage, to: DealStage) {
  if (from === to) return;
  await addActivity(db, { type: "deal", id }, userId, { kind: "stage_change", body: stageChangeText(from, to) });
}

// A move into Won adds the won follow-up (B16); saving a deal that was already at Won is not a move.
async function afterMove(db: Db, id: string, from: DealStage, to: DealStage) {
  if (from !== "Won" && to === "Won") await addWonFollowUp(db, id);
}

// null when there is no such deal (deleted in another tab, or a tampered id).
export async function updateDeal(
  db: Db, id: string, input: DealInput, userId: string | null, now = new Date(),
): Promise<Saved | null> {
  if (!isId(id)) return null;
  const checked = checkDeal(input);
  if (checked.errors) return { id: null, errors: checked.errors };
  const gone = await linksGone(db, checked.values);
  if (gone) return { id: null, errors: gone };
  const from = await setDeal(db, id, checked.values, now);
  if (!from) return null;
  await logStageChange(db, id, userId, from, checked.values.stage);
  await afterMove(db, id, from, checked.values.stage);
  return { id, errors: null };
}

// Moves a deal to another stage (the pipeline board; later the MCP move_deal_stage tool) and logs the move. Returns
// the stage it left and the one it reached; null for no such deal or no such stage. Moving to the stage it is already
// in changes and logs nothing.
export async function moveDealStage(
  db: Db, id: string, stage: string, userId: string | null, now = new Date(),
): Promise<{ from: DealStage; to: DealStage } | null> {
  const to = DEAL_STAGES.find((s) => s === stage);
  if (!to || !isId(id)) return null;
  const [found] = await db.select({ stage: deal.stage }).from(deal).where(eq(deal.id, id)).limit(1);
  if (!found) return null;
  if (found.stage === to) return { from: to, to };
  const from = await setDeal(db, id, { stage: to }, now);
  if (!from) return null; // deleted in between
  await logStageChange(db, id, userId, from, to);
  await afterMove(db, id, from, to);
  return { from, to };
}

export async function deleteDeal(db: Db, id: string): Promise<boolean> {
  if (!isId(id)) return false;
  const gone = await db.delete(deal).where(eq(deal.id, id)).returning({ id: deal.id });
  return gone.length > 0;
}
