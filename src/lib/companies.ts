// Companies (B8): the businesses contacts work for. Plain functions on `db`, so the pages and later the MCP tools
// (get_company) share one set of rules.
import { asc, desc, eq, ilike, or, sql } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "@/lib/db/client";
import { company, contact } from "@/lib/db/schema";
import { likePattern, type ListView } from "@/lib/list-view";

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

// The columns the Companies list can sort by, as they appear in the address (`?sort=website`).
export const COMPANY_SORTS = ["name", "website", "phone"] as const;
export type CompanySort = (typeof COMPANY_SORTS)[number];
export type CompanyView = ListView<CompanySort>;

const SORT_COLUMN = { name: company.name, website: company.website, phone: company.phone } as const;

// With no view (or no sort), newest added first. A search matches the name or website, any capitals. A sort ignores
// capitals and puts blanks last both ways; ties go by name, then id, so the order is the same on every load.
export async function listCompanies(db: Db, view?: CompanyView): Promise<Company[]> {
  const pattern = view?.q ? likePattern(view.q) : null;
  const where = pattern ? or(ilike(company.name, pattern), ilike(company.website, pattern)) : undefined;
  const query = db.select().from(company).where(where);
  if (!view?.sort) return query.orderBy(desc(company.createdAt), desc(company.id));
  const by = sql`lower(nullif(${SORT_COLUMN[view.sort]}, ''))`;
  return query.orderBy(sql`${by} ${sql.raw(view.dir === "desc" ? "desc" : "asc")} nulls last`, sql`lower(${company.name})`, asc(company.id));
}

export async function getCompany(db: Db, id: string): Promise<Company | null> {
  if (!isId(id)) return null;
  const [found] = await db.select().from(company).where(eq(company.id, id)).limit(1);
  return found ?? null;
}

// What the contact form's Company picker offers, A to Z. The website tells two companies of one name apart.
export type CompanyChoice = { id: string; name: string; website: string | null };

export async function listCompanyChoices(db: Db): Promise<CompanyChoice[]> {
  return db.select({ id: company.id, name: company.name, website: company.website }).from(company)
    .orderBy(asc(company.name), asc(company.id));
}

// The people at a company, A to Z, for its page.
export async function listCompanyContacts(db: Db, companyId: string) {
  if (!isId(companyId)) return [];
  return db.select({ id: contact.id, name: contact.name, jobTitle: contact.jobTitle, email: contact.email }).from(contact)
    .where(eq(contact.companyId, companyId)).orderBy(asc(contact.name), asc(contact.id));
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

// Deleting a company keeps its contacts: the foreign key sets their company to null (schema.ts).
export async function deleteCompany(db: Db, id: string): Promise<boolean> {
  if (!isId(id)) return false;
  const gone = await db.delete(company).where(eq(company.id, id)).returning({ id: company.id });
  return gone.length > 0;
}
