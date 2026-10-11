// Home's figures (B14): each one is read as Home reads it and checked against the list its link opens.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestDb } from "@/test/db";
import type { Db } from "@/lib/db/client";
import { deal } from "@/lib/db/schema";
import { monthIn, TIME_ZONE } from "./dates";
import {
  coldDealsTotal, createDeal, dealsPerStage, EMPTY_DEAL, listDeals, listedDealsTotal, moveDealStage, openDealsTotal, readDealView,
  wonInMonth,
} from "./deals";
import { addTask, dueTasks, listDueTasks } from "./tasks";

let t: { db: Db; close(): Promise<void> };
beforeEach(async () => { t = await createTestDb(); });
afterEach(() => t.close());

const DAY = 86_400_000;
const add = (title: string, value: string, stage: string, now?: Date) => createDeal(t.db, { ...EMPTY_DEAL, title, value, stage }, now);

describe("deals per stage", () => {
  it("is every stage at 0 when there are no deals", async () => {
    expect(await dealsPerStage(t.db)).toEqual({ New: 0, Contacted: 0, Proposal: 0, Won: 0, Lost: 0 });
  });

  it("counts each stage, keeps the empty ones at 0, and each count is the rows its stage's list shows", async () => {
    await add("Gutters", "", "New");
    await add("Porch", "", "New");
    await add("Chimney", "", "Proposal");
    await add("Hall roof", "", "Won");
    const counts = await dealsPerStage(t.db);
    expect(counts).toEqual({ New: 2, Contacted: 0, Proposal: 1, Won: 1, Lost: 0 });
    for (const [stage, n] of Object.entries(counts)) {
      expect(await listDeals(t.db, readDealView({ stage }))).toHaveLength(n);
    }
  });

  it("follows a deal as it moves", async () => {
    const { id } = await add("Gutters", "", "Proposal");
    await moveDealStage(t.db, id!, "Lost", null);
    expect(await dealsPerStage(t.db)).toEqual({ New: 0, Contacted: 0, Proposal: 0, Won: 0, Lost: 1 });
  });
});

describe("open deals", () => {
  it("is the exact money and count /deals?open=1 shows", async () => {
    await add("New one", "0.10", "New");
    await add("Contacted one", "0.20", "Contacted");
    await add("No value yet", "", "Proposal");
    await add("Won one", "500", "Won");
    const home = await openDealsTotal(t.db);
    expect(home).toEqual({ count: 3, total: "0.30" });
    const open = readDealView({ open: "1" });
    expect(await openDealsTotal(t.db, open)).toEqual(home);
    expect(await listDeals(t.db, open)).toHaveLength(home.count);
  });
});

describe("won this month", () => {
  // Deals won either side of October's edges in New York.
  async function season() {
    await add("Last of September", "1000", "Won", new Date("2026-10-01T03:59:59Z"));
    await add("First of October", "0.10", "Won", new Date("2026-10-01T04:00:00Z"));
    await add("Last of October", "0.20", "Won", new Date("2026-11-01T03:59:59Z"));
    await add("First of November", "500", "Won", new Date("2026-11-01T04:00:00Z"));
  }

  it("is the business's month: on the first and last moments of October it counts October's deals", async () => {
    await season();
    for (const now of [new Date("2026-10-01T04:00:00Z"), new Date("2026-11-01T03:59:59Z")]) {
      expect(monthIn(TIME_ZONE, now)).toBe("2026-10");
      expect(await wonInMonth(t.db, monthIn(TIME_ZONE, now))).toEqual({ count: 2, total: "0.30" });
    }
    expect(await wonInMonth(t.db, monthIn(TIME_ZONE, new Date("2026-11-01T04:00:00Z")))).toEqual({ count: 1, total: "500.00" });
  });

  it("is what /deals?won=<month> lists, with the same figures", async () => {
    await season();
    const view = readDealView({ won: "2026-10" });
    const home = await wonInMonth(t.db, "2026-10");
    expect(await listedDealsTotal(t.db, view)).toEqual(home);
    expect(await listDeals(t.db, view)).toHaveLength(home.count);
  });
});

describe("going cold", () => {
  it("counts the deals /deals?cold=1 lists, with its figures", async () => {
    const now = new Date("2026-10-15T16:00:00Z");
    const ago = (days: number) => new Date(now.getTime() - days * DAY);
    await t.db.insert(deal).values([
      { title: "Cold gutters", value: "100.10", createdAt: ago(20) },
      { title: "Cold porch", value: "200.20", stage: "Proposal", createdAt: ago(30), lastActivityAt: ago(15) },
      { title: "Warm chimney", value: "50.00", createdAt: ago(20), lastActivityAt: ago(2) },
      { title: "Won hall", value: "500.00", stage: "Won", createdAt: ago(40) },
    ]);
    const home = await coldDealsTotal(t.db, now);
    expect(home).toEqual({ count: 2, total: "300.30" });
    const cold = readDealView({ cold: "1" });
    expect(await openDealsTotal(t.db, cold, now)).toEqual(home);
    expect(await listDeals(t.db, cold, now)).toHaveLength(home.count);
  });

  it("is nothing when no deal is quiet", async () => {
    await add("Just added", "10", "New");
    expect(await coldDealsTotal(t.db)).toEqual({ count: 0, total: "0" });
  });
});

describe("overdue and due today", () => {
  it("are the counts of the lists /tasks?due=overdue and /tasks?due=today show", async () => {
    const { id } = await add("Gutters", "", "New");
    const on = { type: "deal" as const, id: id! };
    await addTask(t.db, on, { title: "Send the quote", dueOn: "2026-10-09" });
    await addTask(t.db, on, { title: "Chase the deposit", dueOn: "2026-10-10" });
    await addTask(t.db, on, { title: "Call back", dueOn: "2026-10-11" });
    await addTask(t.db, on, { title: "Book the visit", dueOn: "2026-10-12" });
    const due = await dueTasks(t.db, "2026-10-11");
    expect([due.overdue.length, due.today.length]).toEqual([2, 1]);
    expect(await listDueTasks(t.db, "overdue", "2026-10-11")).toHaveLength(due.overdue.length);
    expect(await listDueTasks(t.db, "today", "2026-10-11")).toHaveLength(due.today.length);
  });
});
