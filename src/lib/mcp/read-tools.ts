// The MCP read tools (I4): one plain function per tool, taking the database and returning plain data, so they are
// tested without the endpoint and reuse the same record functions as the pages. None of them writes. Agents may see
// record IDs here (they pass them back to get_*); the UI still never shows them.
import type { Db } from "@/lib/db/client";
import { listActivities, type ActivityEntry, type ActivityTarget } from "@/lib/activities";
import { getCompany } from "@/lib/companies";
import { getContact, listContacts } from "@/lib/contacts";
import { addDays, dueWhen, TIME_ZONE, todayIn } from "@/lib/dates";
import { getDeal, listDeals } from "@/lib/deals";
import type { DealStage } from "@/lib/deal-stages";
import { formatMoney } from "@/lib/money";
import { pipelineColumns } from "@/lib/pipeline";
import { listTasks, type TaskLine } from "@/lib/tasks";

export const SEARCH_LIMIT = 20;
export const ACTIVITY_LIMIT = 10;

// Money for an agent: the exact text a person sees ("$1,250.50") and the same amount as a plain number. The stored
// string becomes a number only here, at the edge; numeric(12,2) amounts print back with the same two decimals.
export type Money = { amount: number; formatted: string };

export function money(value: string): Money {
  return { amount: Number(value), formatted: formatMoney(value) };
}

export type Ref = { id: string; name: string };
export type OpenTask = { id: string; title: string; dueOn: string };
export type Activity = { kind: ActivityEntry["kind"]; body: string; at: string; who: string | null };

async function openTasksAndActivities(db: Db, target: ActivityTarget) {
  const [tasks, activities] = await Promise.all([
    listTasks(db, { on: target, status: "open" }),
    listActivities(db, target, ACTIVITY_LIMIT),
  ]);
  return {
    openTasks: tasks.map((t): OpenTask => ({ id: t.id, title: t.title, dueOn: t.dueOn })),
    lastActivities: activities.map((a): Activity => ({ kind: a.kind, body: a.body, at: a.createdAt.toISOString(), who: a.who })),
  };
}

export type ContactMatch = { id: string; name: string; email: string | null; company: string | null };

// search_contacts: up to 20 contacts whose name, email or company matches, A to Z. A blank query lists the first 20.
export async function searchContacts(db: Db, query: string): Promise<ContactMatch[]> {
  const found = await listContacts(db, { q: query.trim(), sort: "name", dir: "asc" });
  return found.slice(0, SEARCH_LIMIT).map((c) => ({ id: c.id, name: c.name, email: c.email, company: c.companyName }));
}

export type ContactRecord = {
  id: string; name: string; email: string | null; phone: string | null; jobTitle: string | null; notes: string | null;
  company: Ref | null; openTasks: OpenTask[]; lastActivities: Activity[];
};

// get_contact: null when there is no such contact.
export async function getContactRecord(db: Db, id: string): Promise<ContactRecord | null> {
  const c = await getContact(db, id);
  if (!c) return null;
  return {
    id: c.id, name: c.name, email: c.email, phone: c.phone, jobTitle: c.jobTitle, notes: c.notes,
    company: c.companyId && c.companyName ? { id: c.companyId, name: c.companyName } : null,
    ...(await openTasksAndActivities(db, { type: "contact", id: c.id })),
  };
}

export type CompanyRecord = {
  id: string; name: string; website: string | null; phone: string | null; notes: string | null;
  openTasks: OpenTask[]; lastActivities: Activity[];
};

// get_company: null when there is no such company.
export async function getCompanyRecord(db: Db, id: string): Promise<CompanyRecord | null> {
  const c = await getCompany(db, id);
  if (!c) return null;
  return {
    id: c.id, name: c.name, website: c.website, phone: c.phone, notes: c.notes,
    ...(await openTasksAndActivities(db, { type: "company", id: c.id })),
  };
}

export type DealRecord = {
  id: string; title: string; stage: DealStage; value: Money | null; expectedClose: string | null; wonOn: string | null;
  source: string | null; lastActivityAt: string | null; contact: Ref | null; company: Ref | null;
  openTasks: OpenTask[]; lastActivities: Activity[];
};

// get_deal: null when there is no such deal.
export async function getDealRecord(db: Db, id: string): Promise<DealRecord | null> {
  const d = await getDeal(db, id);
  if (!d) return null;
  return {
    id: d.id, title: d.title, stage: d.stage, value: d.value === null ? null : money(d.value),
    expectedClose: d.expectedClose, wonOn: d.wonOn, source: d.source, lastActivityAt: d.lastActivityAt?.toISOString() ?? null,
    contact: d.contactId && d.contactName ? { id: d.contactId, name: d.contactName } : null,
    company: d.companyId && d.companyName ? { id: d.companyId, name: d.companyName } : null,
    ...(await openTasksAndActivities(db, { type: "deal", id: d.id })),
  };
}

export type PipelineDeal = { id: string; title: string; value: Money | null; contact: string | null; company: string | null };
export type PipelineStage = { stage: DealStage; count: number; total: Money; deals: PipelineDeal[] };

// list_pipeline: every stage in order, even when empty, as the board shows it (newest deal first in each).
export async function listPipeline(db: Db): Promise<PipelineStage[]> {
  return pipelineColumns(await listDeals(db)).map((col) => ({
    stage: col.stage,
    count: col.count,
    total: money(col.total),
    deals: col.deals.map((d) => ({
      id: d.id, title: d.title, value: d.value === null ? null : money(d.value), contact: d.contactName, company: d.companyName,
    })),
  }));
}

export const MAX_DAYS_AHEAD = 366;

export type DueTask = {
  id: string; title: string; dueOn: string; when: "overdue" | "today" | "later";
  on: { type: TaskLine["on"]["type"]; id: string; name: string };
};

// list_tasks_due: open tasks due on or before the business's today plus `days`, overdue first (oldest first), then by
// day. `now` decides the business's today; tests pass it, the endpoint lets it default.
export async function listTasksDue(db: Db, days: number, now = new Date()): Promise<DueTask[]> {
  const today = todayIn(TIME_ZONE, now);
  const tasks = await listTasks(db, { status: "open", dueBy: addDays(today, days) });
  return tasks.map((t) => ({ id: t.id, title: t.title, dueOn: t.dueOn, when: dueWhen(t.dueOn, today), on: t.on }));
}
