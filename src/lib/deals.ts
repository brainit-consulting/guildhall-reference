// Deals (B9): work the business hopes to win. Plain functions on `db`, so the pages and later the pipeline, the
// dashboard and the MCP tools (get_deal, list_pipeline) share one set of rules.
import { count, desc, eq, getTableColumns, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "@/lib/db/client";
import { company, contact, deal } from "@/lib/db/schema";
import { DEAL_STAGES, OPEN_STAGES, type DealStage } from "@/lib/deal-stages";
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

// A real calendar day: "2026-02-30" is refused rather than rolled into March.
function isDay(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

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

export async function listDeals(db: Db): Promise<DealWithNames[]> {
  return selectDeals(db).orderBy(desc(deal.createdAt), desc(deal.id));
}

export async function getDeal(db: Db, id: string): Promise<DealWithNames | null> {
  if (!isId(id)) return null;
  const [found] = await selectDeals(db).where(eq(deal.id, id)).limit(1);
  return found ?? null;
}

// How many deals are open and what they are worth. Postgres adds the numerics, so the total is exact; deals with no
// value count towards the number but add nothing.
export async function openDealsTotal(db: Db): Promise<{ count: number; total: string }> {
  const [row] = await db.select({ count: count(), total: sql<string>`coalesce(sum(${deal.value}), 0)::text` })
    .from(deal).where(inArray(deal.stage, [...OPEN_STAGES]));
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

// null when there is no such deal (deleted in another tab, or a tampered id).
export async function updateDeal(db: Db, id: string, input: DealInput): Promise<Saved | null> {
  if (!isId(id)) return null;
  const checked = checkDeal(input);
  if (checked.errors) return { id: null, errors: checked.errors };
  const gone = await linksGone(db, checked.values);
  if (gone) return { id: null, errors: gone };
  const [row] = await db.update(deal).set({ ...checked.values, updatedAt: new Date() })
    .where(eq(deal.id, id)).returning({ id: deal.id });
  return row ? { id: row.id, errors: null } : null;
}

export async function deleteDeal(db: Db, id: string): Promise<boolean> {
  if (!isId(id)) return false;
  const gone = await db.delete(deal).where(eq(deal.id, id)).returning({ id: deal.id });
  return gone.length > 0;
}
