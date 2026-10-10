// Companies (B8): the businesses contacts work for. Plain functions on `db`, so the pages and later the MCP tools
// (get_company) share one set of rules.
import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "@/lib/db/client";
import { company } from "@/lib/db/schema";

export type Company = typeof company.$inferSelect;

// What the form sends: every field as typed.
export type CompanyInput = { name: string; website: string; phone: string; notes: string };
export type CompanyValues = { name: string; website: string | null; phone: string | null; notes: string | null };
export type CompanyErrors = Partial<Record<"name", string>>;

export const EMPTY_COMPANY: CompanyInput = { name: "", website: "", phone: "", notes: "" };

const orNull = (s: string) => s.trim() || null;

// Trims each field and turns blanks into null; a sentence per field the form must explain.
export function checkCompany(input: CompanyInput): { values: CompanyValues; errors: null } | { values: null; errors: CompanyErrors } {
  const name = input.name.trim();
  if (!name) return { values: null, errors: { name: "Enter a name." } };
  return {
    values: { name, website: orNull(input.website), phone: orNull(input.phone), notes: orNull(input.notes) },
    errors: null,
  };
}

// The website is kept as typed ("guildhall.example"). Only an http(s) address becomes a link, so a stored
// "javascript:" can never run when clicked; anything else shows as plain text.
export function websiteHref(website: string | null): string | null {
  if (!website) return null;
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(website) ? website : `https://${website}`;
  try {
    const url = new URL(withScheme);
    return url.protocol === "http:" || url.protocol === "https:" ? url.href : null;
  } catch {
    return null;
  }
}

// Ids come from the URL or a form; anything that isn't a uuid can't be a company, and Postgres would reject it.
const isId = (id: string) => z.uuid().safeParse(id).success;

export async function listCompanies(db: Db): Promise<Company[]> {
  return db.select().from(company).orderBy(desc(company.createdAt), desc(company.id));
}

export async function getCompany(db: Db, id: string): Promise<Company | null> {
  if (!isId(id)) return null;
  const [found] = await db.select().from(company).where(eq(company.id, id)).limit(1);
  return found ?? null;
}

type Saved = { id: string; errors: null } | { id: null; errors: CompanyErrors };

export async function createCompany(db: Db, input: CompanyInput): Promise<Saved> {
  const checked = checkCompany(input);
  if (checked.errors) return { id: null, errors: checked.errors };
  const [row] = await db.insert(company).values(checked.values).returning({ id: company.id });
  return { id: row.id, errors: null };
}

// null when there is no such company (deleted in another tab, or a tampered id).
export async function updateCompany(db: Db, id: string, input: CompanyInput): Promise<Saved | null> {
  if (!isId(id)) return null;
  const checked = checkCompany(input);
  if (checked.errors) return { id: null, errors: checked.errors };
  const [row] = await db.update(company).set({ ...checked.values, updatedAt: new Date() })
    .where(eq(company.id, id)).returning({ id: company.id });
  return row ? { id: row.id, errors: null } : null;
}

export async function deleteCompany(db: Db, id: string): Promise<boolean> {
  if (!isId(id)) return false;
  const gone = await db.delete(company).where(eq(company.id, id)).returning({ id: company.id });
  return gone.length > 0;
}
