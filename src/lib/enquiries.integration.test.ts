import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestDb } from "@/test/db";
import type { Db } from "@/lib/db/client";
import { activity, company, contact, deal, enquiry } from "@/lib/db/schema";
import { listActivities } from "./activities";
import { createCompany, EMPTY_COMPANY } from "./companies";
import { createContact, EMPTY_CONTACT } from "./contacts";
import { deleteDeal, getDeal, moveDealStage, updateDeal } from "./deals";
import { EMPTY_ENQUIRY, receiveEnquiry, WEB_FORM, type EnquiryInput } from "./enquiries";

let t: { db: Db; close(): Promise<void> };
beforeEach(async () => { t = await createTestDb(); });
afterEach(() => t.close());

// Noon on 15 Oct in New York, and the next morning there.
const NOW = new Date("2026-10-15T16:00:00Z");
const NEXT_DAY = new Date("2026-10-16T13:00:00Z");

const wat: EnquiryInput = {
  ...EMPTY_ENQUIRY, name: "Wat Tyler", email: "Wat@Lynn.example", phone: "01553 100200", company: "Lynn Tilers",
  message: "We need the barn roof redone before winter.\nCan you quote?",
};

const rows = async () => ({
  contacts: await t.db.select().from(contact),
  companies: await t.db.select().from(company),
  deals: await t.db.select().from(deal),
  activities: await t.db.select().from(activity),
  enquiries: await t.db.select().from(enquiry),
});

describe("receiveEnquiry", () => {
  it("makes the contact, the company, a New deal from the web form and the message as a note", async () => {
    expect(await receiveEnquiry(t.db, wat, NOW)).toEqual({ result: "saved", errors: null });
    const { contacts, companies, deals, enquiries } = await rows();

    expect(companies).toMatchObject([{ name: "Lynn Tilers" }]);
    expect(contacts).toMatchObject([{ name: "Wat Tyler", email: "Wat@Lynn.example", phone: "01553 100200", companyId: companies[0].id }]);
    expect(deals).toMatchObject([{
      title: "Enquiry from Wat Tyler", stage: "New", value: null, source: WEB_FORM, contactId: contacts[0].id, companyId: companies[0].id,
    }]);
    expect(deals[0].lastActivityAt).not.toBeNull();
    expect(await listActivities(t.db, { type: "deal", id: deals[0].id }))
      .toMatchObject([{ kind: "note", body: wat.message, who: WEB_FORM }]);
    expect(enquiries).toMatchObject([{ email: "wat@lynn.example", receivedOn: "2026-10-15", dealId: deals[0].id }]);
  });

  it("reuses the contact for the same email in other capitals and leaves its details as they were", async () => {
    await receiveEnquiry(t.db, wat, NOW);
    expect(await receiveEnquiry(t.db, { ...wat, name: "Someone Else", email: " WAT@lynn.EXAMPLE ", phone: "999", company: "" }, NOW))
      .toEqual({ result: "saved", errors: null });
    const { contacts, deals } = await rows();
    expect(contacts).toMatchObject([{ name: "Wat Tyler", email: "Wat@Lynn.example", phone: "01553 100200" }]);
    expect(deals).toHaveLength(2);
    expect(deals.every((d) => d.contactId === contacts[0].id)).toBe(true);
    // no company typed the second time: the deal takes the contact's
    expect(deals.find((d) => d.title === "Enquiry from Someone Else")?.companyId).toBe(contacts[0].companyId);
  });

  it("fills in a returning contact's blank phone and missing company, and nothing else", async () => {
    // inserted directly: the contact form would trim the spaces, but older or imported rows may have them
    const [added] = await t.db.insert(contact).values({ name: "Wat of Lynn", email: "  wat@LYNN.example" }).returning();
    await receiveEnquiry(t.db, wat, NOW);
    const { contacts, companies } = await rows();
    expect(contacts).toMatchObject([{ id: added.id, name: "Wat of Lynn", email: "  wat@LYNN.example", phone: "01553 100200", companyId: companies[0].id }]);
  });

  it("keeps a returning contact's own company, while the deal takes the one typed", async () => {
    const own = await createCompany(t.db, { ...EMPTY_COMPANY, name: "Tyler & Sons" });
    await createContact(t.db, { ...EMPTY_CONTACT, name: "Wat Tyler", email: "wat@lynn.example", companyId: own.id! });
    await receiveEnquiry(t.db, wat, NOW);
    const { contacts, companies, deals } = await rows();
    const typed = companies.find((c) => c.name === "Lynn Tilers")!;
    expect(contacts[0].companyId).toBe(own.id);
    expect(deals[0].companyId).toBe(typed.id);
  });

  it("picks the earliest added contact when several share the email", async () => {
    const first = await createContact(t.db, { ...EMPTY_CONTACT, name: "First", email: "wat@lynn.example" });
    await createContact(t.db, { ...EMPTY_CONTACT, name: "Second", email: "WAT@lynn.example" });
    await receiveEnquiry(t.db, wat, NOW);
    expect((await rows()).deals[0].contactId).toBe(first.id);
  });

  it("reuses a company already in Guildhall under other capitals", async () => {
    const existing = await createCompany(t.db, { ...EMPTY_COMPANY, name: "LYNN TILERS" });
    await receiveEnquiry(t.db, wat, NOW);
    const { companies, deals, contacts } = await rows();
    expect(companies).toHaveLength(1);
    expect(deals[0].companyId).toBe(existing.id);
    expect(contacts[0].companyId).toBe(existing.id);
  });

  it("saves nothing when the hidden field is filled in, even if the rest is junk", async () => {
    expect(await receiveEnquiry(t.db, { ...wat, trap: "http://spam.example" }, NOW)).toEqual({ result: "ignored", errors: null });
    expect(await receiveEnquiry(t.db, { ...EMPTY_ENQUIRY, trap: "x" }, NOW)).toEqual({ result: "ignored", errors: null });
    expect(await rows()).toEqual({ contacts: [], companies: [], deals: [], activities: [], enquiries: [] });
  });

  it("returns the form's errors and saves nothing", async () => {
    expect(await receiveEnquiry(t.db, { ...wat, email: "wat-at-lynn", message: " " }, NOW)).toEqual({
      result: null,
      errors: { email: "That doesn't look like an email address. Check it and try again.", message: "Tell us what you need." },
    });
    expect((await rows()).contacts).toHaveLength(0);
  });

  it("saves five a day for one email, ignores the sixth, and saves again the next business day", async () => {
    for (let i = 0; i < 5; i++) expect((await receiveEnquiry(t.db, wat, NOW)).result).toBe("saved");
    const before = await rows();
    expect((await receiveEnquiry(t.db, { ...wat, email: "WAT@lynn.example" }, NOW)).result).toBe("ignored");
    expect(await rows()).toEqual(before);

    // another email isn't held back
    expect((await receiveEnquiry(t.db, { ...wat, email: "joan@lynn.example" }, NOW)).result).toBe("saved");
    expect((await receiveEnquiry(t.db, wat, NEXT_DAY)).result).toBe("saved");
    expect((await rows()).enquiries.filter((e) => e.receivedOn === "2026-10-16")).toHaveLength(1);
  });

  it("counts by the business's day: 11pm in New York is still the same day", async () => {
    for (let i = 0; i < 5; i++) await receiveEnquiry(t.db, wat, NOW);
    // 03:00Z on the 16th is 11pm on the 15th in New York
    expect((await receiveEnquiry(t.db, wat, new Date("2026-10-16T03:00:00Z"))).result).toBe("ignored");
  });

  it("keeps counting an enquiry whose deal the owner deleted", async () => {
    for (let i = 0; i < 5; i++) await receiveEnquiry(t.db, wat, NOW);
    for (const d of (await rows()).deals) expect(await deleteDeal(t.db, d.id)).toBe(true);
    const { enquiries } = await rows();
    expect(enquiries).toHaveLength(5);
    expect(enquiries.every((e) => e.dealId === null)).toBe(true);
    expect((await receiveEnquiry(t.db, wat, NOW)).result).toBe("ignored");
  });

  it("keeps the source when the deal is edited or moved", async () => {
    await receiveEnquiry(t.db, wat, NOW);
    const [d] = (await rows()).deals;
    await updateDeal(t.db, d.id, { title: "Barn roof", value: "1200", stage: "Contacted", contactId: d.contactId!, companyId: "", expectedClose: "" }, null);
    await moveDealStage(t.db, d.id, "Proposal", null);
    expect(await getDeal(t.db, d.id)).toMatchObject({ title: "Barn roof", stage: "Proposal", source: WEB_FORM });
  });

  it("leaves deals added by hand with no source", async () => {
    const [d] = await t.db.insert(deal).values({ title: "By hand" }).returning();
    expect(d.source).toBeNull();
  });
});
