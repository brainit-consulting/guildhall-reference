import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { createTestDb } from "@/test/db";
import type { Db } from "@/lib/db/client";
import { activity, company, contact, deal, task, user } from "@/lib/db/schema";
import { listActivities } from "@/lib/activities";
import { createCompany, EMPTY_COMPANY } from "@/lib/companies";
import { createContact, EMPTY_CONTACT } from "@/lib/contacts";
import { createDeal, EMPTY_DEAL, getDeal } from "@/lib/deals";
import { addContact, logActivityOn, moveDeal, READ_ONLY_REFUSAL, type Agent } from "./write-tools";

let t: { db: Db; close(): Promise<void> };
let agent: Agent;
let readOnly: Agent;
beforeEach(async () => {
  t = await createTestDb();
  const [owner] = await t.db.insert(user).values({ id: "owner-1", name: "Margery Kempe", email: "owner@example.com" })
    .returning({ id: user.id });
  agent = { userId: owner.id, canChange: true };
  readOnly = { userId: owner.id, canChange: false };
});
afterEach(() => t.close());

const UNKNOWN = "00000000-0000-4000-8000-000000000000";

async function snapshot() {
  return Promise.all([
    t.db.select().from(contact), t.db.select().from(company), t.db.select().from(deal),
    t.db.select().from(task), t.db.select().from(activity),
  ]);
}

describe("add_contact", () => {
  it("adds a contact at an existing company, any capitals, and says so", async () => {
    const companyId = (await createCompany(t.db, { ...EMPTY_COMPANY, name: "Lynn Tilers" })).id!;
    const result = await addContact(t.db, agent, {
      name: " Wat Tyler ", email: "wat@lynn.example", phone: "01553 000000", job_title: "Foreman", company: "lynn tilers",
    });
    expect(result).toMatchObject({ ok: true, text: `Added 'Wat Tyler' at 'lynn tilers' to contacts. ID ${result.ok && result.id}.` });
    const [row] = await t.db.select().from(contact);
    expect(row).toMatchObject({ name: "Wat Tyler", email: "wat@lynn.example", phone: "01553 000000", jobTitle: "Foreman", companyId });
    expect(await t.db.select().from(company)).toHaveLength(1);
  });

  it("adds the company when there is none of that name", async () => {
    const result = await addContact(t.db, agent, { name: "Ann Lynn", company: "Oak & Ash" });
    expect(result.ok && result.text).toMatch(/^Added 'Ann Lynn' at 'Oak & Ash' \(a new company\) to contacts\./);
    const [firm] = await t.db.select().from(company);
    expect(firm.name).toBe("Oak & Ash");
    const [row] = await t.db.select().from(contact);
    expect(row).toMatchObject({ companyId: firm.id, email: null, phone: null, jobTitle: null });
  });

  it("refuses an email another contact already has, any capitals, naming them", async () => {
    const holder = (await createContact(t.db, { ...EMPTY_CONTACT, name: "Wat Tyler", email: "Wat@Lynn.example" })).id!;
    const before = await snapshot();
    const result = await addContact(t.db, agent, { name: "Walter Tyler", email: " wat@lynn.EXAMPLE ", company: "New Co" });
    expect(result).toEqual({ ok: false, text: `'Wat Tyler' (ID ${holder}) already has wat@lynn.EXAMPLE, so nothing was added.` });
    expect(await snapshot()).toEqual(before);
  });

  it("refuses a blank name or a bad email", async () => {
    expect(await addContact(t.db, agent, { name: "  " })).toEqual({ ok: false, text: "Enter a name. Nothing was added." });
    const bad = await addContact(t.db, agent, { name: "Ann", email: "not-an-email" });
    expect(bad.ok).toBe(false);
    expect(await t.db.select().from(contact)).toHaveLength(0);
  });

  it("refuses an agent without guildhall:write", async () => {
    expect(await addContact(t.db, readOnly, { name: "Ann Lynn", company: "Oak & Ash" })).toEqual({ ok: false, text: READ_ONLY_REFUSAL });
    expect(await t.db.select().from(contact)).toHaveLength(0);
    expect(await t.db.select().from(company)).toHaveLength(0);
  });
});

describe("log_activity", () => {
  it("logs a call on a deal as the person who connected the agent, and updates its last activity", async () => {
    const dealId = (await createDeal(t.db, { ...EMPTY_DEAL, title: "Acme fit-out" })).id!;
    expect((await getDeal(t.db, dealId))!.lastActivityAt).toBeNull();
    const result = await logActivityOn(t.db, agent, { record_id: dealId, kind: "call", text: " Rang about the oak " });
    expect(result).toMatchObject({ ok: true, text: "Logged a call on the deal 'Acme fit-out'." });
    expect(await listActivities(t.db, { type: "deal", id: dealId })).toMatchObject([
      { kind: "call", body: "Rang about the oak", who: "Margery Kempe" },
    ]);
    expect((await getDeal(t.db, dealId))!.lastActivityAt).not.toBeNull();
  });

  it("logs on a contact or a company, and a contact's deals get the last activity", async () => {
    const contactId = (await createContact(t.db, { ...EMPTY_CONTACT, name: "Wat Tyler" })).id!;
    const companyId = (await createCompany(t.db, { ...EMPTY_COMPANY, name: "Lynn Tilers" })).id!;
    const dealId = (await createDeal(t.db, { ...EMPTY_DEAL, title: "Oak staircase", contactId })).id!;
    expect((await logActivityOn(t.db, agent, { record_id: contactId, kind: "meeting", text: "Site visit" })).text)
      .toBe("Logged a meeting on the contact 'Wat Tyler'.");
    expect((await logActivityOn(t.db, agent, { record_id: companyId, kind: "note", text: "Pays in 30 days" })).text)
      .toBe("Logged a note on the company 'Lynn Tilers'.");
    expect((await getDeal(t.db, dealId))!.lastActivityAt).not.toBeNull();
  });

  it("says plainly when the ID matches nothing, or the text is blank", async () => {
    expect(await logActivityOn(t.db, agent, { record_id: UNKNOWN, kind: "note", text: "Hello" })).toEqual({
      ok: false, text: "No contact, company or deal has that ID. Find it with search_contacts or list_pipeline.",
    });
    expect((await logActivityOn(t.db, agent, { record_id: "nonsense", kind: "note", text: "Hello" })).ok).toBe(false);
    const dealId = (await createDeal(t.db, { ...EMPTY_DEAL, title: "Acme fit-out" })).id!;
    expect(await logActivityOn(t.db, agent, { record_id: dealId, kind: "note", text: "   " }))
      .toEqual({ ok: false, text: "Write what happened. Nothing was logged." });
    expect(await t.db.select().from(activity)).toHaveLength(0);
  });

  it("refuses an agent without guildhall:write", async () => {
    const dealId = (await createDeal(t.db, { ...EMPTY_DEAL, title: "Acme fit-out" })).id!;
    const before = await snapshot();
    expect(await logActivityOn(t.db, readOnly, { record_id: dealId, kind: "call", text: "Rang" }))
      .toEqual({ ok: false, text: READ_ONLY_REFUSAL });
    expect(await snapshot()).toEqual(before);
  });
});

describe("move_deal_stage", () => {
  it("moves a deal, logs the move by the person, and says what changed", async () => {
    const dealId = (await createDeal(t.db, { ...EMPTY_DEAL, title: "Acme fit-out", stage: "Contacted" })).id!;
    expect(await moveDeal(t.db, agent, { deal_id: dealId, stage: "Proposal" }))
      .toEqual({ ok: true, id: dealId, text: "Moved 'Acme fit-out' from Contacted to Proposal." });
    expect((await getDeal(t.db, dealId))!.stage).toBe("Proposal");
    expect(await listActivities(t.db, { type: "deal", id: dealId })).toMatchObject([
      { kind: "stage_change", body: "Moved from Contacted to Proposal", who: "Margery Kempe" },
    ]);
  });

  it("runs the Won follow-up once, however often it is moved to Won", async () => {
    const contactId = (await createContact(t.db, { ...EMPTY_CONTACT, name: "Wat Tyler" })).id!;
    const dealId = (await createDeal(t.db, { ...EMPTY_DEAL, title: "Acme fit-out", stage: "Proposal", contactId })).id!;
    expect((await moveDeal(t.db, agent, { deal_id: dealId, stage: "Won" })).text).toBe("Moved 'Acme fit-out' from Proposal to Won.");
    await moveDeal(t.db, agent, { deal_id: dealId, stage: "Proposal" });
    await moveDeal(t.db, agent, { deal_id: dealId, stage: "Won" });
    const tasks = await t.db.select().from(task).where(eq(task.dealId, dealId));
    expect(tasks).toHaveLength(1);
    expect(tasks[0]).toMatchObject({ automation: "won_follow_up", title: "Thank Wat Tyler and ask for a referral" });
  });

  it("changes nothing when the deal is already at that stage", async () => {
    const dealId = (await createDeal(t.db, { ...EMPTY_DEAL, title: "Acme fit-out", stage: "Proposal" })).id!;
    const before = await snapshot();
    expect(await moveDeal(t.db, agent, { deal_id: dealId, stage: "Proposal" }))
      .toEqual({ ok: true, text: "'Acme fit-out' is already at Proposal, so nothing changed." });
    expect(await snapshot()).toEqual(before);
  });

  it("says plainly when the ID matches no deal", async () => {
    const contactId = (await createContact(t.db, { ...EMPTY_CONTACT, name: "Wat Tyler" })).id!;
    for (const id of [UNKNOWN, contactId, "nonsense"]) {
      expect(await moveDeal(t.db, agent, { deal_id: id, stage: "Won" })).toEqual({ ok: false, text: "No deal has that ID. Find it with list_pipeline." });
    }
  });

  it("refuses an agent without guildhall:write", async () => {
    const dealId = (await createDeal(t.db, { ...EMPTY_DEAL, title: "Acme fit-out", stage: "Proposal" })).id!;
    const before = await snapshot();
    expect(await moveDeal(t.db, readOnly, { deal_id: dealId, stage: "Won" })).toEqual({ ok: false, text: READ_ONLY_REFUSAL });
    expect(await snapshot()).toEqual(before);
  });
});
