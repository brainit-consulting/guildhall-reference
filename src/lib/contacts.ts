// Contacts (B7): the people the business deals with. Plain functions on `db`, so the pages and later the MCP tools
// (add_contact, get_contact) share one set of rules.
import { asc, count, desc, eq, getTableColumns, ilike, or, sql } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "@/lib/db/client";
import { company, contact } from "@/lib/db/schema";
import { authErrorMessage, isEmail } from "@/lib/auth/messages";
import { likePattern, type ListView } from "@/lib/list-view";

export type Contact = typeof contact.$inferSelect;
// A contact as the pages show it: with its company's name, null when it has none.
export type ContactWithCompany = Contact & { companyName: string | null };

// What the form sends: every field as typed. companyId is "" for no company.
export type ContactInput = { name: string; email: string; phone: string; jobTitle: string; notes: string; companyId: string };
export type ContactValues = {
  name: string; email: string | null; phone: string | null; jobTitle: string | null; notes: string | null; companyId: string | null;
};
export type ContactErrors = Partial<Record<"name" | "email" | "companyId", string>>;

export const EMPTY_CONTACT: ContactInput = { name: "", email: "", phone: "", jobTitle: "", notes: "", companyId: "" };

const COMPANY_GONE = "That company has been deleted. Pick another, or No company.";

const orNull = (s: string) => s.trim() || null;

// Trims each field and turns blanks into null; a sentence per field the form must explain.
export function checkContact(input: ContactInput): { values: ContactValues; errors: null } | { values: null; errors: ContactErrors } {
  const errors: ContactErrors = {};
  const name = input.name.trim();
  const email = orNull(input.email);
  if (!name) errors.name = "Enter a name.";
  if (email && !isEmail(email)) errors.email = authErrorMessage("INVALID_EMAIL");
  const companyId = orNull(input.companyId);
  if (companyId && !isId(companyId)) errors.companyId = COMPANY_GONE; // only a tampered form sends this
  if (errors.name || errors.email || errors.companyId) return { values: null, errors };
  return {
    values: { name, email, phone: orNull(input.phone), jobTitle: orNull(input.jobTitle), notes: input.notes.trim() || null, companyId },
    errors: null,
  };
}

// Ids come from the URL or a form; anything that isn't a uuid can't be a record, and Postgres would reject it.
function isId(id: string) {
  return z.uuid().safeParse(id).success;
}

const withCompany = { ...getTableColumns(contact), companyName: company.name };

// The columns the Contacts list can sort by, as they appear in the address (`?sort=company`).
export const CONTACT_SORTS = ["name", "company", "email", "phone", "title"] as const;
export type ContactSort = (typeof CONTACT_SORTS)[number];
export type ContactView = ListView<ContactSort>;

const SORT_COLUMN = {
  name: contact.name, company: company.name, email: contact.email, phone: contact.phone, title: contact.jobTitle,
} as const;

// With no view (or no sort), newest added first. A search matches the name, email or company name, any capitals. A
// sort ignores capitals and puts blanks (and no company) last both ways; ties go by name, then id.
export async function listContacts(db: Db, view?: ContactView): Promise<ContactWithCompany[]> {
  const pattern = view?.q ? likePattern(view.q) : null;
  const where = pattern ? or(ilike(contact.name, pattern), ilike(contact.email, pattern), ilike(company.name, pattern)) : undefined;
  const query = db.select(withCompany).from(contact).leftJoin(company, eq(contact.companyId, company.id)).where(where);
  if (!view?.sort) return query.orderBy(desc(contact.createdAt), desc(contact.id));
  const by = sql`lower(nullif(${SORT_COLUMN[view.sort]}, ''))`;
  return query.orderBy(sql`${by} ${sql.raw(view.dir === "desc" ? "desc" : "asc")} nulls last`, sql`lower(${contact.name})`, asc(contact.id));
}

// Every contact in the book, whatever the search: the Contacts page heading's figure.
export async function countContacts(db: Db): Promise<number> {
  const [row] = await db.select({ n: count() }).from(contact);
  return row.n;
}

// What the deal form's Contact picker offers, A to Z. The company tells two people of one name apart.
export type ContactChoice = { id: string; name: string; companyName: string | null };

export async function listContactChoices(db: Db): Promise<ContactChoice[]> {
  return db.select({ id: contact.id, name: contact.name, companyName: company.name }).from(contact)
    .leftJoin(company, eq(contact.companyId, company.id)).orderBy(asc(contact.name), asc(contact.id));
}

export async function getContact(db: Db, id: string): Promise<ContactWithCompany | null> {
  if (!isId(id)) return null;
  const [found] = await db.select(withCompany).from(contact).leftJoin(company, eq(contact.companyId, company.id))
    .where(eq(contact.id, id)).limit(1);
  return found ?? null;
}

// The company may have been deleted while the form was open; say so rather than fail on the foreign key.
async function companyGone(db: Db, companyId: string | null): Promise<ContactErrors | null> {
  if (!companyId) return null;
  const [found] = await db.select({ id: company.id }).from(company).where(eq(company.id, companyId)).limit(1);
  return found ? null : { companyId: COMPANY_GONE };
}

type Saved = { id: string; errors: null } | { id: null; errors: ContactErrors };

export async function createContact(db: Db, input: ContactInput): Promise<Saved> {
  const checked = checkContact(input);
  if (checked.errors) return { id: null, errors: checked.errors };
  const gone = await companyGone(db, checked.values.companyId);
  if (gone) return { id: null, errors: gone };
  const [row] = await db.insert(contact).values(checked.values).returning({ id: contact.id });
  return { id: row.id, errors: null };
}

// null when there is no such contact (deleted in another tab, or a tampered id).
export async function updateContact(db: Db, id: string, input: ContactInput): Promise<Saved | null> {
  if (!isId(id)) return null;
  const checked = checkContact(input);
  if (checked.errors) return { id: null, errors: checked.errors };
  const gone = await companyGone(db, checked.values.companyId);
  if (gone) return { id: null, errors: gone };
  const [row] = await db.update(contact).set({ ...checked.values, updatedAt: new Date() })
    .where(eq(contact.id, id)).returning({ id: contact.id });
  return row ? { id: row.id, errors: null } : null;
}

export async function deleteContact(db: Db, id: string): Promise<boolean> {
  if (!isId(id)) return false;
  const gone = await db.delete(contact).where(eq(contact.id, id)).returning({ id: contact.id });
  return gone.length > 0;
}
