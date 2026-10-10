// Contacts (B7): the people the business deals with. Plain functions on `db`, so the pages and later the MCP tools
// (add_contact, get_contact) share one set of rules.
import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import type { Db } from "@/lib/db/client";
import { contact } from "@/lib/db/schema";
import { authErrorMessage, isEmail } from "@/lib/auth/messages";

export type Contact = typeof contact.$inferSelect;

// What the form sends: every field as typed.
export type ContactInput = { name: string; email: string; phone: string; jobTitle: string; notes: string };
export type ContactValues = { name: string; email: string | null; phone: string | null; jobTitle: string | null; notes: string | null };
export type ContactErrors = Partial<Record<"name" | "email", string>>;

export const EMPTY_CONTACT: ContactInput = { name: "", email: "", phone: "", jobTitle: "", notes: "" };

const orNull = (s: string) => s.trim() || null;

// Trims each field and turns blanks into null; a sentence per field the form must explain.
export function checkContact(input: ContactInput): { values: ContactValues; errors: null } | { values: null; errors: ContactErrors } {
  const errors: ContactErrors = {};
  const name = input.name.trim();
  const email = orNull(input.email);
  if (!name) errors.name = "Enter a name.";
  if (email && !isEmail(email)) errors.email = authErrorMessage("INVALID_EMAIL");
  if (errors.name || errors.email) return { values: null, errors };
  return {
    values: { name, email, phone: orNull(input.phone), jobTitle: orNull(input.jobTitle), notes: input.notes.trim() || null },
    errors: null,
  };
}

// Ids come from the URL or a form; anything that isn't a uuid can't be a contact, and Postgres would reject it.
const isId = (id: string) => z.uuid().safeParse(id).success;

export async function listContacts(db: Db): Promise<Contact[]> {
  return db.select().from(contact).orderBy(desc(contact.createdAt), desc(contact.id));
}

export async function getContact(db: Db, id: string): Promise<Contact | null> {
  if (!isId(id)) return null;
  const [found] = await db.select().from(contact).where(eq(contact.id, id)).limit(1);
  return found ?? null;
}

type Saved = { id: string; errors: null } | { id: null; errors: ContactErrors };

export async function createContact(db: Db, input: ContactInput): Promise<Saved> {
  const checked = checkContact(input);
  if (checked.errors) return { id: null, errors: checked.errors };
  const [row] = await db.insert(contact).values(checked.values).returning({ id: contact.id });
  return { id: row.id, errors: null };
}

// null when there is no such contact (deleted in another tab, or a tampered id).
export async function updateContact(db: Db, id: string, input: ContactInput): Promise<Saved | null> {
  if (!isId(id)) return null;
  const checked = checkContact(input);
  if (checked.errors) return { id: null, errors: checked.errors };
  const [row] = await db.update(contact).set({ ...checked.values, updatedAt: new Date() })
    .where(eq(contact.id, id)).returning({ id: contact.id });
  return row ? { id: row.id, errors: null } : null;
}

export async function deleteContact(db: Db, id: string): Promise<boolean> {
  if (!isId(id)) return false;
  const gone = await db.delete(contact).where(eq(contact.id, id)).returning({ id: contact.id });
  return gone.length > 0;
}
