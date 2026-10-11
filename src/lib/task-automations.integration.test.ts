// B16: the database itself keeps automated tasks to once per deal (or per cold spell) and on deals only.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestDb } from "@/test/db";
import type { Db } from "@/lib/db/client";
import { task } from "@/lib/db/schema";
import { createCompany, EMPTY_COMPANY } from "./companies";
import { createContact, EMPTY_CONTACT } from "./contacts";
import { createDeal, EMPTY_DEAL } from "./deals";
import { createTask, listTasks } from "./tasks";

let t: { db: Db; close(): Promise<void> };
beforeEach(async () => { t = await createTestDb(); });
afterEach(() => t.close());

async function setUp() {
  const companyId = (await createCompany(t.db, { ...EMPTY_COMPANY, name: "Lee Plumbing" })).id!;
  const contactId = (await createContact(t.db, { ...EMPTY_CONTACT, name: "Ann Lee", companyId })).id!;
  const dealId = (await createDeal(t.db, { ...EMPTY_DEAL, title: "Kitchen refit", contactId, companyId })).id!;
  return { companyId, contactId, dealId };
}

type Row = typeof task.$inferInsert;
const insert = (row: Omit<Row, "title" | "dueOn">) => t.db.insert(task).values({ title: "Follow up", dueOn: "2026-10-18", ...row });

// the constraint that refused the row, so a test can't pass because a different rule tripped
async function refusedBy(row: Omit<Row, "title" | "dueOn">): Promise<string | undefined> {
  try {
    await insert(row);
  } catch (e) {
    return ((e as { cause?: { constraint?: string } }).cause)?.constraint;
  }
  throw new Error("the row was saved");
}

const spell = new Date("2026-09-20T15:00:00Z");
const nextSpell = new Date("2026-10-09T15:00:00Z");

describe("won follow-ups", () => {
  it("allows one per deal", async () => {
    const { dealId } = await setUp();
    await insert({ dealId, automation: "won_follow_up" });
    expect(await refusedBy({ dealId, automation: "won_follow_up" })).toBe("task_one_won_follow_up");
  });

  it("does nothing on conflict, leaving the first", async () => {
    const { dealId } = await setUp();
    await insert({ dealId, automation: "won_follow_up" });
    await t.db.insert(task).values({ title: "Second", dueOn: "2026-10-19", dealId, automation: "won_follow_up" }).onConflictDoNothing();
    expect((await t.db.select().from(task)).map((x) => x.title)).toEqual(["Follow up"]);
  });

  it("never carries a cold spell", async () => {
    const { dealId } = await setUp();
    expect(await refusedBy({ dealId, automation: "won_follow_up", coldSince: spell })).toBe("task_cold_since_on_check_in");
  });
});

describe("cold check-ins", () => {
  it("allows one per deal per cold spell", async () => {
    const { dealId } = await setUp();
    await insert({ dealId, automation: "cold_check_in", coldSince: spell });
    expect(await refusedBy({ dealId, automation: "cold_check_in", coldSince: spell })).toBe("task_one_check_in_per_cold_spell");
    await insert({ dealId, automation: "cold_check_in", coldSince: nextSpell });
    expect(await t.db.select().from(task)).toHaveLength(2);
  });

  it("always says which cold spell", async () => {
    const { dealId } = await setUp();
    expect(await refusedBy({ dealId, automation: "cold_check_in" })).toBe("task_cold_since_on_check_in");
  });
});

describe("any automated task", () => {
  it("is on a deal, never a contact or a company", async () => {
    const { contactId, companyId } = await setUp();
    for (const on of [{ contactId }, { companyId }]) {
      expect(await refusedBy({ ...on, automation: "won_follow_up" })).toBe("task_automation_on_deal");
      expect(await refusedBy({ ...on, automation: "cold_check_in", coldSince: spell })).toBe("task_automation_on_deal");
    }
  });
});

describe("a person's tasks", () => {
  it("never carry a cold spell", async () => {
    const { dealId } = await setUp();
    expect(await refusedBy({ dealId, coldSince: spell })).toBe("task_cold_since_on_check_in");
  });

  it("save as many as they like on one deal, beside the automated ones, and read as before", async () => {
    const { dealId } = await setUp();
    await insert({ dealId, automation: "won_follow_up" });
    await insert({ dealId, automation: "cold_check_in", coldSince: spell });
    for (const title of ["Send the quote", "Send the quote", "Book the fitters"]) {
      expect((await createTask(t.db, { type: "deal", id: dealId }, { title, dueOn: "2026-10-20" })).errors).toBeNull();
    }
    const mine = (await t.db.select().from(task)).filter((x) => x.automation === null);
    expect(mine.map((x) => [x.title, x.coldSince])).toEqual([
      ["Send the quote", null], ["Send the quote", null], ["Book the fitters", null],
    ]);
    expect(await listTasks(t.db)).toHaveLength(5);
  });
});
