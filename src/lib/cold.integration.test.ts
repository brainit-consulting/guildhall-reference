import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestDb } from "@/test/db";
import type { Db } from "@/lib/db/client";
import { deal } from "@/lib/db/schema";
import { logActivity } from "./activities";
import { isCold, quietDays } from "./cold";
import { createCompany, EMPTY_COMPANY } from "./companies";
import { createContact, EMPTY_CONTACT } from "./contacts";
import { coldDeals, getDeal, listDeals, moveDealStage, openDealsTotal, readDealView } from "./deals";

let t: { db: Db; close(): Promise<void> };
beforeEach(async () => { t = await createTestDb(); });
afterEach(() => t.close());

const DAY = 86_400_000;
const ago = (from: Date, days: number, ms = 0) => new Date(from.getTime() - days * DAY - ms);

async function insert(values: typeof deal.$inferInsert) {
  const [row] = await t.db.insert(deal).values(values).returning();
  return row;
}

describe("the going-cold query", () => {
  // Noon on 15 Oct in New York, where the line is the start of 2 Oct (04:00Z, EDT). And the start of 8 Nov, the
  // first EST day 14 days after an EDT one: its line, the start of 26 Oct, is still 04:00Z.
  const cases = [
    ["mid-October", new Date("2026-10-15T16:00:00Z"), new Date("2026-10-02T04:00:00Z")],
    ["across the 1 Nov clock change", new Date("2026-11-08T05:00:00Z"), new Date("2026-10-26T04:00:00Z")],
  ] as const;
  for (const [label, now, line] of cases) {
    it(`agrees with isCold on deals either side of the line, ${label}`, async () => {
      const added = ago(line, 60);
      await insert({ title: "Last logged just before", stage: "New", createdAt: added, lastActivityAt: ago(line, 0, 1) });
      await insert({ title: "Last logged at the line", stage: "Contacted", createdAt: added, lastActivityAt: line });
      await insert({ title: "Never logged, added just before", stage: "Proposal", createdAt: ago(line, 0, 1) });
      await insert({ title: "Never logged, added at the line", stage: "New", createdAt: line });
      await insert({ title: "Won long ago", stage: "Won", createdAt: added, lastActivityAt: added });
      await insert({ title: "Lost long ago", stage: "Lost", createdAt: added });
      await insert({ title: "Logged an hour ago", stage: "Proposal", createdAt: added, lastActivityAt: ago(now, 0, 3_600_000) });

      const all = await listDeals(t.db);
      const byRule = all.filter((d) => isCold(d, now)).map((d) => d.title).sort();
      const byQuery = (await coldDeals(t.db, now)).map((d) => d.title).sort();
      expect(byQuery).toEqual(["Last logged just before", "Never logged, added just before"]);
      expect(byQuery).toEqual(byRule);
      // a Date written through Drizzle reads back as the same instant
      expect(all.find((d) => d.title === "Last logged just before")!.lastActivityAt).toEqual(ago(line, 0, 1));
      for (const d of all.filter((d) => d.title.endsWith("at the line"))) expect(quietDays(d, now)).toBe(13);
    });
  }

  it("lists longest quiet first, with company name and value", async () => {
    const now = new Date("2026-10-15T16:00:00Z");
    const companyId = (await createCompany(t.db, { ...EMPTY_COMPANY, name: "Lynn Tilers" })).id!;
    await insert({ title: "Quiet 20 days", value: "1200.50", companyId, createdAt: ago(now, 40), lastActivityAt: ago(now, 20) });
    await insert({ title: "Quiet 30 days", createdAt: ago(now, 30) });
    await insert({ title: "Quiet 15 days", stage: "Proposal", createdAt: ago(now, 40), lastActivityAt: ago(now, 15) });
    await insert({ title: "Quiet 13 days", createdAt: ago(now, 40), lastActivityAt: ago(now, 13) });
    const cold = await coldDeals(t.db, now);
    expect(cold.map((d) => d.title)).toEqual(["Quiet 30 days", "Quiet 20 days", "Quiet 15 days"]);
    expect(cold[1]).toMatchObject({ value: "1200.50", companyName: "Lynn Tilers" });
    expect(cold.map((d) => quietDays(d, now))).toEqual([30, 20, 15]);
  });

  it("holds a deal added now, by the database's clock, to be warm", async () => {
    await insert({ title: "Just added" });
    expect(await coldDeals(t.db)).toEqual([]);
    const [d] = await listDeals(t.db);
    expect(Math.abs(d.createdAt.getTime() - Date.now())).toBeLessThan(60_000);
  });
});

describe("logging activity", () => {
  // The real clock: an activity takes the database's time.
  async function quietDeal() {
    const companyId = (await createCompany(t.db, { ...EMPTY_COMPANY, name: "Lynn Tilers" })).id!;
    const contactId = (await createContact(t.db, { ...EMPTY_CONTACT, name: "Wat Tyler", companyId })).id!;
    const row = await insert({ title: "Re-roof the hall", contactId, companyId, createdAt: ago(new Date(), 15) });
    expect((await coldDeals(t.db)).map((d) => d.id)).toEqual([row.id]);
    return { deal: row.id, contact: contactId, company: companyId };
  }

  for (const on of ["deal", "contact", "company"] as const) {
    it(`on the ${on} takes a deal quiet for 15 days off`, async () => {
      const ids = await quietDeal();
      await logActivity(t.db, { type: on, id: ids[on] }, null, { kind: "call", body: "Rang about the roof." });
      expect(await coldDeals(t.db)).toEqual([]);
      const now = new Date();
      expect(isCold((await getDeal(t.db, ids.deal))!, now)).toBe(false);
      expect(await listDeals(t.db, readDealView({ cold: "1" }), now)).toEqual([]);
    });
  }

  it("a stage change counts too, and Won is never cold", async () => {
    const { deal: id } = await quietDeal();
    await moveDealStage(t.db, id, "Contacted", null);
    expect(await coldDeals(t.db)).toEqual([]);
    await t.db.update(deal).set({ lastActivityAt: ago(new Date(), 20) }).where(eq(deal.id, id));
    expect(await coldDeals(t.db)).toHaveLength(1);
    await t.db.update(deal).set({ stage: "Won" }).where(eq(deal.id, id));
    expect(await coldDeals(t.db)).toEqual([]);
  });
});

describe("the Going cold filter", () => {
  it("shows only deals going cold, combines with search and stage, and the open figures follow it", async () => {
    const now = new Date("2026-10-15T16:00:00Z");
    await insert({ title: "Cold gutters", value: "100.10", createdAt: ago(now, 20) });
    await insert({ title: "Cold porch", value: "200.20", stage: "Proposal", createdAt: ago(now, 20) });
    await insert({ title: "Warm gutters", value: "999.00", createdAt: ago(now, 20), lastActivityAt: ago(now, 2) });
    await insert({ title: "Won gutters", value: "500.00", stage: "Won", createdAt: ago(now, 20) });

    const cold = readDealView({ cold: "1" });
    expect((await listDeals(t.db, cold, now)).map((d) => d.title).sort()).toEqual(["Cold gutters", "Cold porch"]);
    expect(await openDealsTotal(t.db, cold, now)).toEqual({ count: 2, total: "300.30" });

    const coldGutters = readDealView({ cold: "1", q: "gutters" });
    expect((await listDeals(t.db, coldGutters, now)).map((d) => d.title)).toEqual(["Cold gutters"]);
    expect(await openDealsTotal(t.db, coldGutters, now)).toEqual({ count: 1, total: "100.10" });

    expect(await listDeals(t.db, readDealView({ cold: "1", stage: "Won" }), now)).toEqual([]);
    expect(await listDeals(t.db, readDealView({ cold: "yes" }), now)).toHaveLength(4);
    expect(await openDealsTotal(t.db, readDealView({}), now)).toEqual({ count: 3, total: "1299.30" });
  });
});
