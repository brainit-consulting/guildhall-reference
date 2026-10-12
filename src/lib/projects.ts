// Projects (I10): the work done for a client, with a budget and the days it runs. Plain functions on `db`, so the
// pages and later the MCP tools (list_projects) share one set of rules.
import { asc, eq, getTableColumns, sql } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "@/lib/db/client";
import { clientName } from "@/lib/clients";
import { isDay } from "@/lib/dates";
import { client, company, contact, project, PROJECT_STATUSES, type ProjectStatus } from "@/lib/db/schema";
import { parseMoney } from "@/lib/money";

export { PROJECT_STATUSES, type ProjectStatus } from "@/lib/db/schema";

export type Project = typeof project.$inferSelect;
// A project as the pages show it: with its client's current name.
export type ProjectWithClient = Project & { clientName: string };

// What the form sends: every field as typed. Dates are "" or YYYY-MM-DD, as a date field sends them.
export type ProjectInput = { name: string; clientId: string; budget: string; startOn: string; endOn: string };
export type ProjectValues = { name: string; clientId: string; budget: string; startOn: string; endOn: string };
export type ProjectErrors = Partial<Record<keyof ProjectInput, string>>;

export const EMPTY_PROJECT: ProjectInput = { name: "", clientId: "", budget: "", startOn: "", endOn: "" };

export const PICK_CLIENT = "Pick a client.";
export const ENDS_BEFORE_START = "The end can't be before the start.";

// Ids come from the URL or a form; anything that isn't a uuid can't be a record, and Postgres would reject it.
const isId = (id: string) => z.uuid().safeParse(id).success;

function checkDayField(typed: string, blank: string): { day: string | null; error: string | null } {
  const day = typed.trim();
  if (!day) return { day: null, error: blank };
  if (!isDay(day)) return { day: null, error: "Enter a date, like 12 Oct 2026." };
  return { day, error: null };
}

// Trims each field and turns money into "1234.50"; a sentence per field the form must explain. The end may be the
// start day (a one-day job) but not before it.
export function checkProject(input: ProjectInput): { values: ProjectValues; errors: null } | { values: null; errors: ProjectErrors } {
  const errors: ProjectErrors = {};
  const name = input.name.trim();
  if (!name) errors.name = "Enter a name.";

  const clientId = input.clientId.trim();
  if (!isId(clientId)) errors.clientId = PICK_CLIENT;

  let budget: string | null = null;
  if (!input.budget.trim()) errors.budget = "Enter a budget, like 4500.00.";
  else {
    const money = parseMoney(input.budget);
    if (money.error) errors.budget = money.error;
    else budget = money.value;
  }

  const start = checkDayField(input.startOn, "Enter the start date.");
  if (start.error) errors.startOn = start.error;
  const end = checkDayField(input.endOn, "Enter the end date.");
  if (end.error) errors.endOn = end.error;
  // YYYY-MM-DD compares correctly as text
  else if (start.day && end.day && end.day < start.day) errors.endOn = ENDS_BEFORE_START;

  if (Object.keys(errors).length > 0 || !budget || !start.day || !end.day) return { values: null, errors };
  return { values: { name, clientId, budget, startOn: start.day, endOn: end.day }, errors: null };
}

const withClient = { ...getTableColumns(project), clientName };

function selectProjects(db: Db) {
  return db.select(withClient).from(project)
    .innerJoin(client, eq(project.clientId, client.id))
    .leftJoin(company, eq(client.companyId, company.id))
    .leftJoin(contact, eq(client.contactId, contact.id));
}

// Active before Done; within each, the earliest start first, then by name and id, so the order is the same on every
// load.
const ORDER = [sql`(${project.status} = 'Done')`, asc(project.startOn), sql`lower(${project.name})`, asc(project.id)];

export async function listProjects(db: Db): Promise<ProjectWithClient[]> {
  return selectProjects(db).orderBy(...ORDER);
}

export async function listClientProjects(db: Db, clientId: string): Promise<ProjectWithClient[]> {
  if (!isId(clientId)) return [];
  return selectProjects(db).where(eq(project.clientId, clientId)).orderBy(...ORDER);
}

export async function getProject(db: Db, id: string): Promise<ProjectWithClient | null> {
  if (!isId(id)) return null;
  const [found] = await selectProjects(db).where(eq(project.id, id)).limit(1);
  return found ?? null;
}

// The client may be gone (a tampered form): say so rather than fail on the foreign key.
async function clientExists(db: Db, clientId: string): Promise<boolean> {
  const [found] = await db.select({ id: client.id }).from(client).where(eq(client.id, clientId)).limit(1);
  return !!found;
}

type Saved = { id: string; errors: null } | { id: null; errors: ProjectErrors };

// A new project is Active.
export async function createProject(db: Db, input: ProjectInput): Promise<Saved> {
  const checked = checkProject(input);
  if (checked.errors) return { id: null, errors: checked.errors };
  if (!(await clientExists(db, checked.values.clientId))) return { id: null, errors: { clientId: PICK_CLIENT } };
  const [row] = await db.insert(project).values(checked.values).returning({ id: project.id });
  return { id: row.id, errors: null };
}

// Leaves the status as it is. null when there is no such project (deleted in another tab, or a tampered id).
export async function updateProject(db: Db, id: string, input: ProjectInput, now = new Date()): Promise<Saved | null> {
  if (!isId(id)) return null;
  const checked = checkProject(input);
  if (checked.errors) return { id: null, errors: checked.errors };
  if (!(await clientExists(db, checked.values.clientId))) return { id: null, errors: { clientId: PICK_CLIENT } };
  const saved = await db.update(project).set({ ...checked.values, updatedAt: now }).where(eq(project.id, id))
    .returning({ id: project.id });
  return saved.length > 0 ? { id, errors: null } : null;
}

// "Mark done" (and "Mark active" to undo it). false when there is no such project or no such status.
export async function setProjectStatus(db: Db, id: string, status: string, now = new Date()): Promise<boolean> {
  const to = PROJECT_STATUSES.find((s): s is ProjectStatus => s === status);
  if (!to || !isId(id)) return false;
  const saved = await db.update(project).set({ status: to, updatedAt: now }).where(eq(project.id, id))
    .returning({ id: project.id });
  return saved.length > 0;
}

export async function deleteProject(db: Db, id: string): Promise<boolean> {
  if (!isId(id)) return false;
  const gone = await db.delete(project).where(eq(project.id, id)).returning({ id: project.id });
  return gone.length > 0;
}
