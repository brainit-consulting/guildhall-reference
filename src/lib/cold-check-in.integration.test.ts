// B16: one check-in per cold spell, never two open at once, made when Home loads.
import { asc, eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestDb } from "@/test/db";
import type { Db } from "@/lib/db/client";
import { deal, task } from "@/lib/db/schema";
import { logActivity } from "./activities";
import { checkInColdDeals } from "./cold-check-in";
import { createCompany, EMPTY_COMPANY } from "./companies";
import { createContact, EMPTY_CONTACT } from "./contacts";
import { TIME_ZONE, todayIn } from "./dates";
import { coldDeals, moveDealStage } from "./deals";
import { dueTasks, listTasks, setTaskDone } from "./tasks";

let t: { db: Db; close(): Promise<void> };
beforeEach(async () => { t = await createTestDb(); });
afterEach(() => t.close());

const DAY = 86_400_000;
const ago = (from: Date, days: number) => new Date(from.getTime() - days * DAY);
const later = (from: Date, days: number) => new Date(from.getTime() + days * DAY);

async function insertDeal(values: Partial<typeof deal.$inferInsert>) {
  const [row] = await t.db.insert(deal).values({ title: "Kitchen refit", ...values }).returning();
  return row;
}

// Ann Lee at Lee Plumbing, about a Kitchen refit added `quiet` days before `now` and never touched since.
async function annLee(now: Date, quiet = 15) {
  const companyId = (await createCompany(t.db, { ...EMPTY_COMPANY, name: "Lee Plumbing" })).id!;
  const contactId = (await createContact(t.db, { ...EMPTY_CONTACT, name: "Ann Lee", companyId })).id!;
  const d = await insertDeal({ contactId, companyId, createdAt: ago(now, quiet) });
  return { companyId, contactId, dealId: d.id };
}

const checkIns = () => t.db.select().from(task).where(eq(task.automation, "cold_check_in")).orderBy(asc(task.createdAt), asc(task.id));
const tick = async (id: string) => expect((await setTaskDone(t.db, id, true)).error).toBeNull();
const call = (dealId: string) => logActivity(t.db, { type: "deal", id: dealId }, null, { kind: "call", body: "Rang Ann" });

describe("a deal quiet for 15 days", () => {
  it("gets one check-in on the deal, due today, in Home's Due today", async () => {
    const now = new Date("2026-10-15T16:00:00Z");
    const { dealId } = await annLee(now);
    await checkInColdDeals(t.db, now);
    const [made, ...more] = await checkIns();
    expect(more).toEqual([]);
    expect(made).toMatchObject({ title: "Check in with Ann Lee about Kitchen refit", dueOn: "2026-10-15", dealId, doneAt: null });
    expect((await dueTasks(t.db, "2026-10-15")).today.map((x) => x.title)).toEqual(["Check in with Ann Lee about Kitchen refit"]);
    expect((await listTasks(t.db, { on: { type: "deal", id: dealId } })).map((x) => x.title))
      .toEqual(["Check in with Ann Lee about Kitchen refit"]);
  });

  it("keeps the spell exactly as the deal holds it", async () => {
    const now = new Date();
    // created_at as the database writes it, to the microsecond
    const [d] = await t.db.insert(deal).values({ title: "Porch" }).returning();
    await checkInColdDeals(t.db, later(now, 15));
    const [made] = await checkIns();
    const [same] = await t.db.select({ id: task.id }).from(task).innerJoin(deal, eq(task.dealId, deal.id))
      .where(eq(task.coldSince, deal.createdAt));
    expect(made.dealId).toBe(d.id);
    expect(same?.id).toBe(made.id);
  });

  it("gets nothing more when Home loads again, the same day or the next", async () => {
    const now = new Date("2026-10-15T16:00:00Z");
    await annLee(now);
    await checkInColdDeals(t.db, now);
    await checkInColdDeals(t.db, now);
    await checkInColdDeals(t.db, later(now, 1));
    expect(await checkIns()).toHaveLength(1);
  });

  it("gets nothing more once its check-in is ticked, though it is still cold", async () => {
    const now = new Date("2026-10-15T16:00:00Z");
    const { dealId } = await annLee(now);
    await checkInColdDeals(t.db, now);
    await tick((await checkIns())[0].id);
    await checkInColdDeals(t.db, later(now, 3));
    expect((await coldDeals(t.db, later(now, 3))).map((d) => d.id)).toEqual([dealId]);
    expect(await checkIns()).toHaveLength(1);
  });

  it("gets one task when two tabs load Home at the same moment", async () => {
    const now = new Date("2026-10-15T16:00:00Z");
    await annLee(now);
    await Promise.all([checkInColdDeals(t.db, now), checkInColdDeals(t.db, now), checkInColdDeals(t.db, now)]);
    expect(await checkIns()).toHaveLength(1);
  });
});

describe("a new cold spell", () => {
  it("starts over after a call: nothing while it is fresh, a new check-in 14 days on", async () => {
    // the call is stamped with the database's clock, so the test runs on real time
    const now = new Date();
    const { dealId } = await annLee(now);
    await checkInColdDeals(t.db, now);
    const [first] = await checkIns();
    await tick(first.id);
    expect((await call(dealId)).errors).toBeNull();

    await checkInColdDeals(t.db, now);
    await checkInColdDeals(t.db, later(now, 13));
    expect(await checkIns()).toHaveLength(1);

    await checkInColdDeals(t.db, later(now, 15));
    const [, second, ...more] = await checkIns();
    expect(more).toEqual([]);
    expect(second).toMatchObject({ dealId, doneAt: null, dueOn: todayIn(TIME_ZONE, later(now, 15)) });
    const [{ lastActivityAt }] = await t.db.select().from(deal).where(eq(deal.id, dealId));
    expect(second.coldSince).toEqual(lastActivityAt);
    expect(second.coldSince!.getTime()).toBeGreaterThan(first.coldSince!.getTime());
  });

  const touches = [
    ["a note on its contact", (ids: { contactId: string }) =>
      logActivity(t.db, { type: "contact", id: ids.contactId }, null, { kind: "note", body: "Emailed" })],
    ["a note on its company", (ids: { companyId: string }) =>
      logActivity(t.db, { type: "company", id: ids.companyId }, null, { kind: "note", body: "Emailed" })],
    ["a stage change", (ids: { dealId: string }) => moveDealStage(t.db, ids.dealId, "Proposal", null)],
  ] as const;
  for (const [label, touch] of touches) {
    it(`starts over after ${label}`, async () => {
      const now = new Date();
      const ids = await annLee(now);
      await checkInColdDeals(t.db, now);
      await tick((await checkIns())[0].id);
      await touch(ids);
      await checkInColdDeals(t.db, later(now, 13));
      expect(await checkIns()).toHaveLength(1);
      await checkInColdDeals(t.db, later(now, 15));
      expect(await checkIns()).toHaveLength(2);
    });
  }

  it("doesn't tick the open check-in when an activity is logged", async () => {
    const now = new Date();
    const { dealId } = await annLee(now);
    await checkInColdDeals(t.db, now);
    await call(dealId);
    expect((await checkIns())[0].doneAt).toBeNull();
  });

  it("waits while a check-in from an earlier spell is still open", async () => {
    const now = new Date("2026-10-15T16:00:00Z");
    const { dealId } = await annLee(now, 40);
    await checkInColdDeals(t.db, ago(now, 20));
    // something logged 20 days ago: a new spell, and cold again by now
    await t.db.update(deal).set({ lastActivityAt: ago(now, 20) }).where(eq(deal.id, dealId));
    await checkInColdDeals(t.db, now);
    const [old, ...more] = await checkIns();
    expect(more).toEqual([]);

    await tick(old.id);
    await checkInColdDeals(t.db, now);
    const [, fresh] = await checkIns();
    expect(fresh).toMatchObject({ coldSince: ago(now, 20), dueOn: "2026-10-15", doneAt: null });
  });
});

describe("the title", () => {
  it("names the contact, else the company, else the customer", async () => {
    const now = new Date("2026-10-15T16:00:00Z");
    const companyId = (await createCompany(t.db, { ...EMPTY_COMPANY, name: "Lynn Tilers" })).id!;
    const contactId = (await createContact(t.db, { ...EMPTY_CONTACT, name: "Ann Lee" })).id!;
    await insertDeal({ title: "Kitchen refit", contactId, companyId, createdAt: ago(now, 20) });
    await insertDeal({ title: "Bathroom", companyId, createdAt: ago(now, 20) });
    await insertDeal({ title: "Gutters", createdAt: ago(now, 20) });
    await checkInColdDeals(t.db, now);
    expect((await checkIns()).map((x) => x.title).sort()).toEqual([
      "Check in with Ann Lee about Kitchen refit",
      "Check in with Lynn Tilers about Bathroom",
      "Check in with the customer about Gutters",
    ]);
  });
});

describe("the due day", () => {
  // EDT: New York is UTC-4, so 03:59Z on the 16th is still the 15th there
  const cases = [
    [new Date("2026-10-16T03:59:00Z"), "2026-10-15"],
    [new Date("2026-10-16T04:00:00Z"), "2026-10-16"],
  ] as const;
  for (const [now, day] of cases) {
    it(`is ${day} in New York at ${now.toISOString()}`, async () => {
      await annLee(now, 20);
      await checkInColdDeals(t.db, now);
      expect((await checkIns()).map((x) => x.dueOn)).toEqual([day]);
    });
  }
});

describe("deals that get none", () => {
  it("leaves Won, Lost and recently touched deals alone, and does nothing with no deals", async () => {
    const now = new Date("2026-10-15T16:00:00Z");
    await checkInColdDeals(t.db, now);
    await insertDeal({ title: "Won long ago", stage: "Won", createdAt: ago(now, 60), lastActivityAt: ago(now, 60) });
    await insertDeal({ title: "Lost long ago", stage: "Lost", createdAt: ago(now, 60) });
    await insertDeal({ title: "Called last week", stage: "Proposal", createdAt: ago(now, 60), lastActivityAt: ago(now, 7) });
    await insertDeal({ title: "Added 13 days ago", createdAt: ago(now, 13) });
    await checkInColdDeals(t.db, now);
    expect(await checkIns()).toEqual([]);
  });
});
