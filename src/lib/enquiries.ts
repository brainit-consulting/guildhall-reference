// Enquiries (B15): what someone sends from the public form becomes a contact (reused by email), a New deal and a note,
// without anyone typing it in. Plain functions on `db`, so the /enquire page and anything later share one rule.
import { and, asc, count, eq, sql } from "drizzle-orm";
import type { Db } from "@/lib/db/client";
import { company, contact, deal, enquiry } from "@/lib/db/schema";
import { addActivity } from "@/lib/activities";
import { normaliseEmail } from "@/lib/access";
import { authErrorMessage, isEmail } from "@/lib/auth/messages";
import { TIME_ZONE, todayIn } from "@/lib/dates";

// What a deal made from an enquiry says it came from.
export const WEB_FORM = "Web form";

// How many enquiries one email may send in a business day; the rest are quietly ignored.
export const ENQUIRIES_PER_DAY = 5;

// What the form sends, as typed. `trap` is a field people never see; only a bot fills it in.
export type EnquiryInput = { name: string; email: string; phone: string; company: string; message: string; trap: string };
export type EnquiryValues = { name: string; email: string; phone: string | null; company: string | null; message: string };
export type EnquiryErrors = Partial<Record<"name" | "email" | "phone" | "company" | "message", string>>;

export const EMPTY_ENQUIRY: EnquiryInput = { name: "", email: "", phone: "", company: "", message: "", trap: "" };

// Enough for any real enquiry; stops a script posting a novel.
export const ENQUIRY_CAPS = { name: 200, email: 254, phone: 40, company: 200, message: 5000 } as const;

const tooLong = (cap: number) => `Keep this under ${cap.toLocaleString("en-US")} characters.`;

// Trims every field, turns a blank phone or company into null; a sentence per field the form must explain.
export function checkEnquiry(input: EnquiryInput): { values: EnquiryValues; errors: null } | { values: null; errors: EnquiryErrors } {
  const errors: EnquiryErrors = {};
  const name = input.name.trim();
  const email = input.email.trim();
  const phone = input.phone.trim();
  const companyName = input.company.trim();
  const message = input.message.trim();

  if (!name) errors.name = "Enter your name.";
  else if (name.length > ENQUIRY_CAPS.name) errors.name = tooLong(ENQUIRY_CAPS.name);

  if (!email) errors.email = "Enter your email address.";
  else if (email.length > ENQUIRY_CAPS.email) errors.email = tooLong(ENQUIRY_CAPS.email);
  else if (!isEmail(email)) errors.email = authErrorMessage("INVALID_EMAIL");

  if (phone.length > ENQUIRY_CAPS.phone) errors.phone = tooLong(ENQUIRY_CAPS.phone);
  if (companyName.length > ENQUIRY_CAPS.company) errors.company = tooLong(ENQUIRY_CAPS.company);

  if (!message) errors.message = "Tell us what you need.";
  else if (message.length > ENQUIRY_CAPS.message) errors.message = tooLong(ENQUIRY_CAPS.message);

  if (Object.keys(errors).length > 0) return { values: null, errors };
  return { values: { name, email, phone: phone || null, company: companyName || null, message }, errors: null };
}

// "saved" and "ignored" look the same to the visitor (one thank-you either way); only tests tell them apart.
export type Received = { result: "saved" | "ignored"; errors: null } | { result: null; errors: EnquiryErrors };

// The trap, then the form's checks, then the day's limit for this email; only then is anything written, all at once.
// `now` decides the business's day; tests pass it, the page lets it default.
export async function receiveEnquiry(db: Db, input: EnquiryInput, now = new Date()): Promise<Received> {
  if (input.trap.trim()) return { result: "ignored", errors: null };
  const checked = checkEnquiry(input);
  if (checked.errors) return { result: null, errors: checked.errors };
  const values = checked.values;
  const email = normaliseEmail(values.email);
  const receivedOn = todayIn(TIME_ZONE, now);

  const [sent] = await db.select({ n: count() }).from(enquiry)
    .where(and(eq(enquiry.email, email), eq(enquiry.receivedOn, receivedOn)));
  if (sent.n >= ENQUIRIES_PER_DAY) return { result: "ignored", errors: null };

  await db.transaction(async (t) => {
    const tx = t as unknown as Db;
    const companyId = values.company ? await findOrAddCompany(tx, values.company) : null;
    const who = await findOrAddContact(tx, values, email, companyId);
    const [row] = await tx.insert(deal).values({
      title: `Enquiry from ${values.name}`, stage: "New", source: WEB_FORM, contactId: who.id, companyId: companyId ?? who.companyId,
    }).returning({ id: deal.id });
    await addActivity(tx, { type: "deal", id: row.id }, null, { kind: "note", body: values.message });
    await tx.insert(enquiry).values({ email, receivedOn, dealId: row.id });
  });
  return { result: "saved", errors: null };
}

// The company of that name, any capitals (the earliest added if several), or a new one.
async function findOrAddCompany(db: Db, name: string): Promise<string> {
  const [found] = await db.select({ id: company.id }).from(company)
    .where(sql`lower(trim(${company.name})) = ${name.toLowerCase()}`)
    .orderBy(asc(company.createdAt), asc(company.id)).limit(1);
  if (found) return found.id;
  const [row] = await db.insert(company).values({ name }).returning({ id: company.id });
  return row.id;
}

// The contact with that email, ignoring capitals and spaces (the earliest added if several), or a new one. Anyone can
// type anyone's email, so an existing contact's details are never overwritten: only a blank phone or a missing
// company is filled in.
async function findOrAddContact(
  db: Db, values: EnquiryValues, email: string, companyId: string | null,
): Promise<{ id: string; companyId: string | null }> {
  const [found] = await db.select({ id: contact.id, phone: contact.phone, companyId: contact.companyId }).from(contact)
    .where(sql`lower(trim(${contact.email})) = ${email}`)
    .orderBy(asc(contact.createdAt), asc(contact.id)).limit(1);
  if (!found) {
    const [row] = await db.insert(contact)
      .values({ name: values.name, email: values.email, phone: values.phone, companyId })
      .returning({ id: contact.id, companyId: contact.companyId });
    return row;
  }
  const fill = {
    ...(!found.phone?.trim() && values.phone ? { phone: values.phone } : {}),
    ...(!found.companyId && companyId ? { companyId } : {}),
  };
  if (Object.keys(fill).length > 0) await db.update(contact).set({ ...fill, updatedAt: new Date() }).where(eq(contact.id, found.id));
  return { id: found.id, companyId: found.companyId ?? fill.companyId ?? null };
}

// What the visitor reads once the form is sent, saved or ignored alike, from the name they typed.
export function thanksFor(name: string): string {
  const who = name.trim();
  return who ? `Thanks, ${who}. We'll be in touch.` : "Thanks. We'll be in touch.";
}
