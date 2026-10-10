// Tasks (B12): what the business has promised someone, due on a day, on a contact, company or deal. Plain functions
// on `db`, so the record pages, the Tasks page, Home, the B16 automations and the MCP list_tasks_due tool share them.
import { and, asc, eq, isNotNull, isNull, lte, sql, type SQL } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "@/lib/db/client";
import { company, contact, deal, task } from "@/lib/db/schema";
import { exists } from "@/lib/activities";
import { isDay } from "@/lib/dates";

// The one record a task is about.
export type TaskTarget = { type: "contact" | "company" | "deal"; id: string };

// A task as any list shows it, with what it belongs to: the contact's name, the company's name or the deal's title.
export type TaskLine = {
  id: string; title: string; dueOn: string; doneAt: Date | null;
  on: TaskTarget & { name: string };
};

// What the form sends, as typed. dueOn is "" or YYYY-MM-DD, as <input type="date"> sends it.
export type TaskInput = { title: string; dueOn: string };
export type TaskValues = { title: string; dueOn: string };
export type TaskErrors = Partial<Record<keyof TaskInput | "target", string>>;

const GONE: Record<TaskTarget["type"], string> = {
  contact: "That contact isn't in Guildhall any more, so no task was added.",
  company: "That company isn't in Guildhall any more, so no task was added.",
  deal: "That deal isn't in Guildhall any more, so no task was added.",
};

// Ids come from the URL or a form; anything that isn't a uuid can't be a record, and Postgres would reject it.
const isId = (id: string) => z.uuid().safeParse(id).success;

// Trims the title; a sentence per field the form must explain. Past days are fine: yesterday's promise still counts.
export function checkTask(input: TaskInput): { values: TaskValues; errors: null } | { values: null; errors: TaskErrors } {
  const errors: TaskErrors = {};
  const title = input.title.trim();
  if (!title) errors.title = "Write what you promised.";
  const dueOn = input.dueOn.trim();
  if (!isDay(dueOn)) errors.dueOn = "Pick a due date.";
  if (errors.title || errors.dueOn) return { values: null, errors };
  return { values: { title, dueOn }, errors: null };
}

type Saved = { id: string; errors: null } | { id: null; errors: TaskErrors };

// Writes a task whose title and day are already known to be good (the B16 automations call this directly).
export async function addTask(db: Db, target: TaskTarget, values: TaskValues): Promise<Saved> {
  if (!(await exists(db, target))) return { id: null, errors: { target: GONE[target.type] } };
  const on = { contactId: target.type === "contact" ? target.id : null, companyId: target.type === "company" ? target.id : null,
    dealId: target.type === "deal" ? target.id : null };
  const [row] = await db.insert(task).values({ ...values, ...on }).returning({ id: task.id });
  return { id: row.id, errors: null };
}

// "Add task" on a contact, company or deal page.
export async function createTask(db: Db, target: TaskTarget, input: TaskInput): Promise<Saved> {
  const checked = checkTask(input);
  if (checked.errors) return { id: null, errors: checked.errors };
  return addTask(db, target, checked.values);
}

// Ticks (done) or unticks a task. Ticking one already done keeps when it was first done.
export async function setTaskDone(db: Db, taskId: string, done: boolean): Promise<{ error: string | null }> {
  const gone = { error: "That task isn't in Guildhall any more." };
  if (!isId(taskId)) return gone;
  const [row] = await db.update(task)
    .set({ doneAt: done ? sql`coalesce(${task.doneAt}, now())` : null })
    .where(eq(task.id, taskId)).returning({ id: task.id });
  return row ? { error: null } : gone;
}

export type TaskFilter = {
  on?: TaskTarget;          // only this record's tasks
  status?: "open" | "done"; // left out: both
  dueBy?: string;           // YYYY-MM-DD: due on or before this day
};

const column = { contact: task.contactId, company: task.companyId, deal: task.dealId } as const;

// The one task list every page shares, sorted by due day, then title.
export async function listTasks(db: Db, filter: TaskFilter = {}): Promise<TaskLine[]> {
  const where: SQL[] = [];
  if (filter.on) {
    if (!isId(filter.on.id)) return [];
    where.push(eq(column[filter.on.type], filter.on.id));
  }
  if (filter.status === "open") where.push(isNull(task.doneAt));
  if (filter.status === "done") where.push(isNotNull(task.doneAt));
  if (filter.dueBy !== undefined) {
    if (!isDay(filter.dueBy)) return [];
    where.push(lte(task.dueOn, filter.dueBy));
  }

  const rows = await db.select({
    id: task.id, title: task.title, dueOn: task.dueOn, doneAt: task.doneAt,
    contactId: task.contactId, companyId: task.companyId, dealId: task.dealId,
    contactName: contact.name, companyName: company.name, dealTitle: deal.title,
  }).from(task)
    .leftJoin(contact, eq(task.contactId, contact.id))
    .leftJoin(company, eq(task.companyId, company.id))
    .leftJoin(deal, eq(task.dealId, deal.id))
    .where(and(...where))
    .orderBy(asc(task.dueOn), asc(sql`lower(${task.title})`), asc(task.id));

  return rows.map((r) => ({
    id: r.id, title: r.title, dueOn: r.dueOn, doneAt: r.doneAt,
    // the check constraint guarantees exactly one, and the cascade that it still exists
    on: r.contactId ? { type: "contact", id: r.contactId, name: r.contactName! }
      : r.companyId ? { type: "company", id: r.companyId, name: r.companyName! }
      : { type: "deal", id: r.dealId!, name: r.dealTitle! },
  }));
}
