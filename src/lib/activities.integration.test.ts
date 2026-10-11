import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestDb } from "@/test/db";
import type { Db } from "@/lib/db/client";
import { activity, deal, user } from "@/lib/db/schema";
import { addActivity, listActivities, logActivity, type ActivityTarget } from "./activities";
import { createCompany, deleteCompany, EMPTY_COMPANY } from "./companies";
import { createContact, deleteContact, EMPTY_CONTACT } from "./contacts";
import { createDeal, deleteDeal, EMPTY_DEAL, getDeal } from "./deals";

let t: { db: Db; close(): Promise<void> };
beforeEach(async () => { t = await createTestDb(); });
afterEach(() => t.close());

const UNKNOWN = "00000000-0000-4000-8000-000000000000";

async function setUp() {
  await t.db.insert(user).values({ id: "u1", name: "Margery Kempe", email: "margery@example.com" });
  const companyId = (await createCompany(t.db, { ...EMPTY_COMPANY, name: "Lynn Tilers" })).id!;
  const contactId = (await createContact(t.db, { ...EMPTY_CONTACT, name: "Wat Tyler", companyId })).id!;
  const dealId = (await createDeal(t.db, { ...EMPTY_DEAL, title: "Re-roof the hall", contactId, companyId })).id!;
  return {
    contact: { type: "contact", id: contactId } as ActivityTarget,
    company: { type: "company", id: companyId } as ActivityTarget,
    deal: { type: "deal", id: dealId } as ActivityTarget,
  };
}

describe("logging an activity", () => {
  it("saves a call on a contact with who logged it, and it heads that contact's timeline", async () => {
    const on = await setUp();
    const saved = await logActivity(t.db, on.contact, "u1", { kind: "call", body: " Rang about the roof. " });
    expect(saved.errors).toBeNull();
    const [entry] = await listActivities(t.db, on.contact);
    expect(entry).toMatchObject({ id: saved.id, kind: "call", body: "Rang about the roof.", who: "Margery Kempe" });
    expect(entry.createdAt).toBeInstanceOf(Date);
  });

  it("keeps each record's timeline to its own activities", async () => {
    const on = await setUp();
    await logActivity(t.db, on.contact, "u1", { kind: "call", body: "On the contact" });
    await logActivity(t.db, on.company, "u1", { kind: "meeting", body: "On the company" });
    await logActivity(t.db, on.deal, "u1", { kind: "note", body: "On the deal" });
    expect((await listActivities(t.db, on.contact)).map((a) => a.body)).toEqual(["On the contact"]);
    expect((await listActivities(t.db, on.company)).map((a) => a.body)).toEqual(["On the company"]);
    expect((await listActivities(t.db, on.deal)).map((a) => [a.kind, a.body])).toEqual([["note", "On the deal"]]);
  });

  it("saves nothing without text or with a kind the form doesn't offer", async () => {
    const on = await setUp();
    expect(await logActivity(t.db, on.deal, "u1", { kind: "note", body: "  " })).toEqual({ id: null, errors: { body: "Write what happened." } });
    expect((await logActivity(t.db, on.deal, "u1", { kind: "stage_change", body: "Moved" })).errors).toEqual({ kind: "Pick note, call or meeting." });
    expect(await t.db.select().from(activity)).toEqual([]);
  });

  it("says so when the record has gone", async () => {
    await setUp();
    for (const type of ["contact", "company", "deal"] as const) {
      for (const id of [UNKNOWN, "not-an-id"]) {
        const result = await logActivity(t.db, { type, id }, "u1", { kind: "note", body: "Hello" });
        expect(result).toEqual({ id: null, errors: { target: `That ${type} has been deleted, so nothing was logged.` } });
      }
    }
    expect(await t.db.select().from(activity)).toEqual([]);
  });

  it("lets Guildhall itself add a stage change", async () => {
    const on = await setUp();
    expect((await addActivity(t.db, on.deal, null, { kind: "stage_change", body: "Moved from New to Contacted" })).errors).toBeNull();
    expect(await listActivities(t.db, on.deal)).toMatchObject([{ kind: "stage_change", body: "Moved from New to Contacted", who: null }]);
  });

  it("refuses a row on no record or on two, in the database itself", async () => {
    const on = await setUp();
    await expect(t.db.insert(activity).values({ kind: "note", body: "Nowhere" })).rejects.toThrow();
    await expect(t.db.insert(activity).values({ kind: "note", body: "Twice", contactId: on.contact.id, dealId: on.deal.id })).rejects.toThrow();
  });
});

describe("a deal's last activity", () => {
  const lastActivity = async (id: string) => (await getDeal(t.db, id))!.lastActivityAt;
  const loggedAt = async (id: string) => (await t.db.select().from(activity)).find((a) => a.id === id)!.createdAt;

  it("is nothing until something is logged", async () => {
    const on = await setUp();
    expect(await lastActivity(on.deal.id)).toBeNull();
    await logActivity(t.db, on.contact, "u1", { kind: "call", body: " " }); // refused, so not activity
    expect(await lastActivity(on.deal.id)).toBeNull();
  });

  it("is when a call was logged on the deal's contact, and only that contact's deals move", async () => {
    const on = await setUp();
    const otherContact = (await createContact(t.db, { ...EMPTY_CONTACT, name: "Jack Straw" })).id!;
    const otherDeal = (await createDeal(t.db, { ...EMPTY_DEAL, title: "Mend the gate", contactId: otherContact })).id!;
    const { id } = await logActivity(t.db, on.contact, "u1", { kind: "call", body: "Rang about the roof." });
    expect(await lastActivity(on.deal.id)).toEqual(await loggedAt(id!));
    expect(await lastActivity(otherDeal)).toBeNull();
  });

  it("is when something was logged on the deal itself or on its company", async () => {
    const on = await setUp();
    const onDeal = await logActivity(t.db, on.deal, "u1", { kind: "note", body: "Sent the quote." });
    expect(await lastActivity(on.deal.id)).toEqual(await loggedAt(onDeal.id!));
    const onCompany = await logActivity(t.db, on.company, "u1", { kind: "meeting", body: "Met at the yard." });
    expect(await lastActivity(on.deal.id)).toEqual(await loggedAt(onCompany.id!));
  });

  it("touches every deal of that contact or company", async () => {
    const on = await setUp();
    const second = (await createDeal(t.db, { ...EMPTY_DEAL, title: "Porch", companyId: on.company.id })).id!;
    const { id } = await logActivity(t.db, on.company, "u1", { kind: "call", body: "Rang the office." });
    expect(await lastActivity(on.deal.id)).toEqual(await loggedAt(id!));
    expect(await lastActivity(second)).toEqual(await loggedAt(id!));
  });

  it("never goes back in time", async () => {
    const on = await setUp();
    const later = new Date("2099-01-01T00:00:00Z");
    await t.db.update(deal).set({ lastActivityAt: later });
    await logActivity(t.db, on.contact, "u1", { kind: "call", body: "Rang" });
    expect(await lastActivity(on.deal.id)).toEqual(later);
  });
});

describe("listing a timeline", () => {
  it("is newest first", async () => {
    const on = await setUp();
    await t.db.insert(activity).values([
      { kind: "note", body: "Older", dealId: on.deal.id, userId: "u1", createdAt: new Date("2026-10-01T09:00:00Z") },
      { kind: "call", body: "Newer", dealId: on.deal.id, userId: "u1", createdAt: new Date("2026-10-09T09:00:00Z") },
    ]);
    await logActivity(t.db, on.deal, "u1", { kind: "meeting", body: "Newest" });
    expect((await listActivities(t.db, on.deal)).map((a) => a.body)).toEqual(["Newest", "Newer", "Older"]);
  });

  it("is empty for a record with nothing logged or no such record", async () => {
    const on = await setUp();
    expect(await listActivities(t.db, on.contact)).toEqual([]);
    expect(await listActivities(t.db, { type: "deal", id: UNKNOWN })).toEqual([]);
    expect(await listActivities(t.db, { type: "deal", id: "not-an-id" })).toEqual([]);
  });

  it("keeps an activity whose author is removed, without a name", async () => {
    const on = await setUp();
    await logActivity(t.db, on.contact, "u1", { kind: "call", body: "Rang" });
    await t.db.delete(user);
    expect(await listActivities(t.db, on.contact)).toMatchObject([{ body: "Rang", who: null }]);
  });

  it("names what wrote an activity when no person did, and a person's name over it", async () => {
    const on = await setUp();
    await addActivity(t.db, on.deal, null, { kind: "note", body: "Sent from the site" }, "Web form");
    await addActivity(t.db, on.deal, null, { kind: "stage_change", body: "Moved from New to Contacted" });
    await addActivity(t.db, on.deal, "u1", { kind: "note", body: "Rang back" }, "Web form");
    expect(await listActivities(t.db, on.deal)).toEqual(expect.arrayContaining([
      expect.objectContaining({ body: "Sent from the site", who: "Web form" }),
      expect.objectContaining({ body: "Moved from New to Contacted", who: null }),
      expect.objectContaining({ body: "Rang back", who: "Margery Kempe" }),
    ]));
  });
});

describe("deleting the record", () => {
  it("deletes its activities and no one else's", async () => {
    const on = await setUp();
    await logActivity(t.db, on.contact, "u1", { kind: "call", body: "Contact" });
    await logActivity(t.db, on.company, "u1", { kind: "call", body: "Company" });
    await logActivity(t.db, on.deal, "u1", { kind: "call", body: "Deal" });
    await deleteDeal(t.db, on.deal.id);
    expect((await t.db.select().from(activity)).map((a) => a.body).sort()).toEqual(["Company", "Contact"]);
    await deleteContact(t.db, on.contact.id);
    await deleteCompany(t.db, on.company.id);
    expect(await t.db.select().from(activity)).toEqual([]);
  });
});
