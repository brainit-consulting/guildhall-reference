import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestDb } from "@/test/db";
import type { Db } from "@/lib/db/client";
import { activity, contact, deal, task } from "@/lib/db/schema";
import { logActivity } from "@/lib/activities";
import { createCompany, EMPTY_COMPANY } from "@/lib/companies";
import { createContact, EMPTY_CONTACT } from "@/lib/contacts";
import { createDeal, EMPTY_DEAL } from "@/lib/deals";
import { createTask, setTaskDone } from "@/lib/tasks";
import {
  getCompanyRecord, getContactRecord, getDealRecord, listPipeline, listTasksDue, searchContacts,
} from "./read-tools";

let t: { db: Db; close(): Promise<void> };
beforeEach(async () => { t = await createTestDb(); });
afterEach(() => t.close());

const UNKNOWN = "00000000-0000-4000-8000-000000000000";

async function book() {
  const companyId = (await createCompany(t.db, { ...EMPTY_COMPANY, name: "Lynn Tilers", website: "lynn.example" })).id!;
  const contactId = (await createContact(t.db, { ...EMPTY_CONTACT, name: "Wat Tyler", email: "wat@lynn.example", companyId })).id!;
  const dealId = (await createDeal(t.db, { ...EMPTY_DEAL, title: "Oak staircase", value: "12500.50", contactId, companyId })).id!;
  return { companyId, contactId, dealId };
}

// What each read leaves behind, so a test can show nothing changed.
async function snapshot() {
  return Promise.all([t.db.select().from(contact), t.db.select().from(deal), t.db.select().from(task), t.db.select().from(activity)]);
}

describe("search_contacts", () => {
  it("matches the name, email or company, A to Z, with each contact's ID", async () => {
    const { contactId } = await book();
    const ann = (await createContact(t.db, { ...EMPTY_CONTACT, name: "Ann Lynn" })).id!;
    await createContact(t.db, { ...EMPTY_CONTACT, name: "Someone Else" });
    expect(await searchContacts(t.db, "  LYNN ")).toEqual([
      { id: ann, name: "Ann Lynn", email: null, company: null },
      { id: contactId, name: "Wat Tyler", email: "wat@lynn.example", company: "Lynn Tilers" },
    ]);
  });

  it("returns at most 20", async () => {
    for (let i = 0; i < 23; i++) await createContact(t.db, { ...EMPTY_CONTACT, name: `Joiner ${String(i).padStart(2, "0")}` });
    const found = await searchContacts(t.db, "joiner");
    expect(found).toHaveLength(20);
    expect(found[0].name).toBe("Joiner 00");
  });
});

describe("get_contact, get_company, get_deal", () => {
  it("reads a contact with their company, open tasks and last 10 activities, newest first", async () => {
    const { contactId, companyId } = await book();
    const open = (await createTask(t.db, { type: "contact", id: contactId }, { title: "Send drawings", dueOn: "2026-10-20" })).id!;
    const done = (await createTask(t.db, { type: "contact", id: contactId }, { title: "Measure up", dueOn: "2026-10-01" })).id!;
    await setTaskDone(t.db, done, true);
    for (let i = 1; i <= 12; i++) await logActivity(t.db, { type: "contact", id: contactId }, null, { kind: "note", body: `Note ${i}` });

    const found = await getContactRecord(t.db, contactId);
    expect(found).toMatchObject({
      id: contactId, name: "Wat Tyler", email: "wat@lynn.example", company: { id: companyId, name: "Lynn Tilers" },
      openTasks: [{ id: open, title: "Send drawings", dueOn: "2026-10-20" }],
    });
    expect(found!.lastActivities).toHaveLength(10);
    expect(found!.lastActivities[0]).toMatchObject({ kind: "note", body: "Note 12" });
    expect(found!.lastActivities[9].body).toBe("Note 3");
    expect(found!.lastActivities[0].at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("reads a company with its open tasks and activities", async () => {
    const { companyId } = await book();
    await createTask(t.db, { type: "company", id: companyId }, { title: "Chase invoice", dueOn: "2026-10-12" });
    await logActivity(t.db, { type: "company", id: companyId }, null, { kind: "call", body: "Rang the office" });
    expect(await getCompanyRecord(t.db, companyId)).toMatchObject({
      id: companyId, name: "Lynn Tilers", website: "lynn.example",
      openTasks: [{ title: "Chase invoice", dueOn: "2026-10-12" }],
      lastActivities: [{ kind: "call", body: "Rang the office" }],
    });
  });

  it("reads a deal with its value as text and as a number, its people, tasks and activities", async () => {
    const { dealId, contactId, companyId } = await book();
    await createTask(t.db, { type: "deal", id: dealId }, { title: "Send quote", dueOn: "2026-10-14" });
    await logActivity(t.db, { type: "deal", id: dealId }, null, { kind: "meeting", body: "Site visit" });
    expect(await getDealRecord(t.db, dealId)).toMatchObject({
      id: dealId, title: "Oak staircase", stage: "New", value: { amount: 12500.5, formatted: "$12,500.50" },
      contact: { id: contactId, name: "Wat Tyler" }, company: { id: companyId, name: "Lynn Tilers" },
      openTasks: [{ title: "Send quote" }], lastActivities: [{ kind: "meeting", body: "Site visit" }],
    });
  });

  it("gives a deal with no value, contact or company nulls", async () => {
    const id = (await createDeal(t.db, { ...EMPTY_DEAL, title: "Loose enquiry" })).id!;
    expect(await getDealRecord(t.db, id)).toMatchObject({ value: null, contact: null, company: null, openTasks: [], lastActivities: [] });
  });

  it("returns null for an unknown or malformed ID", async () => {
    await book();
    for (const id of [UNKNOWN, "not-an-id"]) {
      expect(await getContactRecord(t.db, id)).toBeNull();
      expect(await getCompanyRecord(t.db, id)).toBeNull();
      expect(await getDealRecord(t.db, id)).toBeNull();
    }
  });
});

describe("list_pipeline", () => {
  it("gives every stage in order with its count, exact total and deals", async () => {
    await book();
    await createDeal(t.db, { ...EMPTY_DEAL, title: "Bookcase", value: "0.10" });
    await createDeal(t.db, { ...EMPTY_DEAL, title: "Shelf", value: "0.20" });
    await createDeal(t.db, { ...EMPTY_DEAL, title: "Gate", value: "900", stage: "Won" });
    await createDeal(t.db, { ...EMPTY_DEAL, title: "No value yet", stage: "Won" });

    const stages = await listPipeline(t.db);
    expect(stages.map((s) => [s.stage, s.count, s.total.formatted])).toEqual([
      ["New", 3, "$12,500.80"], ["Contacted", 0, "$0.00"], ["Proposal", 0, "$0.00"], ["Won", 2, "$900.00"], ["Lost", 0, "$0.00"],
    ]);
    expect(stages[0].total.amount).toBe(12500.8);
    expect(stages[0].deals.map((d) => d.title)).toEqual(["Shelf", "Bookcase", "Oak staircase"]);
    expect(stages[0].deals[2]).toMatchObject({ value: { amount: 12500.5, formatted: "$12,500.50" }, contact: "Wat Tyler", company: "Lynn Tilers" });
    expect(stages[3].deals.find((d) => d.title === "No value yet")!.value).toBeNull();
  });
});

describe("list_tasks_due", () => {
  // 15:00 UTC on 11 Oct 2026 is 11:00 in New York: the business's today is 2026-10-11
  const now = new Date("2026-10-11T15:00:00Z");

  it("lists open tasks due within the days given, overdue first, and leaves out done ones and later ones", async () => {
    const { contactId, dealId } = await book();
    const on = { type: "deal" as const, id: dealId };
    await createTask(t.db, on, { title: "In a week", dueOn: "2026-10-18" });
    await createTask(t.db, on, { title: "Too far", dueOn: "2026-10-19" });
    await createTask(t.db, { type: "contact", id: contactId }, { title: "Today", dueOn: "2026-10-11" });
    await createTask(t.db, on, { title: "Last week", dueOn: "2026-10-04" });
    const done = (await createTask(t.db, on, { title: "Done already", dueOn: "2026-10-05" })).id!;
    await setTaskDone(t.db, done, true);

    expect((await listTasksDue(t.db, 7, now)).map((x) => [x.title, x.when, x.on.name])).toEqual([
      ["Last week", "overdue", "Oak staircase"], ["Today", "today", "Wat Tyler"], ["In a week", "later", "Oak staircase"],
    ]);
    expect((await listTasksDue(t.db, 0, now)).map((x) => x.title)).toEqual(["Last week", "Today"]);
  });
});

describe("every read tool", () => {
  it("changes nothing", async () => {
    const { contactId, companyId, dealId } = await book();
    await createTask(t.db, { type: "deal", id: dealId }, { title: "Send quote", dueOn: "2026-10-14" });
    const before = await snapshot();
    await searchContacts(t.db, "wat");
    await getContactRecord(t.db, contactId);
    await getCompanyRecord(t.db, companyId);
    await getDealRecord(t.db, dealId);
    await listPipeline(t.db);
    await listTasksDue(t.db, 30);
    expect(await snapshot()).toEqual(before);
  });
});
