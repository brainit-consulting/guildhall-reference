import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestDb } from "@/test/db";
import type { Db } from "@/lib/db/client";
import { deal, user } from "@/lib/db/schema";
import { listActivities } from "./activities";
import { createCompany, deleteCompany, EMPTY_COMPANY } from "./companies";
import { createContact, deleteContact, EMPTY_CONTACT, listContactChoices } from "./contacts";
import { createDeal, deleteDeal, EMPTY_DEAL, getDeal, listDeals, moveDealStage, openDealsTotal, updateDeal } from "./deals";

let t: { db: Db; close(): Promise<void> };
beforeEach(async () => { t = await createTestDb(); });
afterEach(() => t.close());

const UNKNOWN = "00000000-0000-4000-8000-000000000000";

async function people() {
  const companyId = (await createCompany(t.db, { ...EMPTY_COMPANY, name: "Lynn Tilers" })).id!;
  const contactId = (await createContact(t.db, { ...EMPTY_CONTACT, name: "Wat Tyler", companyId })).id!;
  return { companyId, contactId };
}

describe("creating a deal", () => {
  it("saves every field, starts at New and reads back with the contact's and company's names", async () => {
    const { companyId, contactId } = await people();
    const { id, errors } = await createDeal(t.db, {
      ...EMPTY_DEAL, title: "Re-roof the hall", value: "12,500.5", contactId, companyId, expectedClose: "2026-11-30",
    });
    expect(errors).toBeNull();
    expect(await getDeal(t.db, id!)).toMatchObject({
      title: "Re-roof the hall", value: "12500.50", stage: "New", contactId, companyId, expectedClose: "2026-11-30",
      contactName: "Wat Tyler", companyName: "Lynn Tilers",
    });
  });

  it("starts at New when the stage isn't said", async () => {
    const [row] = await t.db.insert(deal).values({ title: "Gutters" }).returning();
    expect(row.stage).toBe("New");
  });

  it("saves nothing without a title, or with a contact or company that has gone", async () => {
    expect(await createDeal(t.db, { ...EMPTY_DEAL, title: "" })).toEqual({ id: null, errors: { title: "Enter a title." } });
    const result = await createDeal(t.db, { ...EMPTY_DEAL, title: "Gutters", contactId: UNKNOWN, companyId: UNKNOWN });
    expect(result.errors).toEqual({ contactId: expect.any(String), companyId: expect.any(String) });
    expect(await listDeals(t.db)).toEqual([]);
  });

  it("lists deals newest first", async () => {
    await t.db.insert(deal).values([
      { title: "Older", createdAt: new Date("2026-10-01T09:00:00Z") },
      { title: "Newer", createdAt: new Date("2026-10-09T09:00:00Z") },
    ]);
    await createDeal(t.db, { ...EMPTY_DEAL, title: "Newest" });
    expect((await listDeals(t.db)).map((d) => d.title)).toEqual(["Newest", "Newer", "Older"]);
  });
});

describe("updating a deal", () => {
  it("changes the fields and clears the ones left blank", async () => {
    const { companyId, contactId } = await people();
    const { id } = await createDeal(t.db, { ...EMPTY_DEAL, title: "Gutters", value: "800", contactId, companyId, expectedClose: "2026-11-01" });
    const result = await updateDeal(t.db, id!, { ...EMPTY_DEAL, title: "Gutters and downpipes", value: "950.25", stage: "Proposal" }, null);
    expect(result).toEqual({ id, errors: null });
    expect(await getDeal(t.db, id!)).toMatchObject({
      title: "Gutters and downpipes", value: "950.25", stage: "Proposal", contactId: null, companyId: null, expectedClose: null,
    });
  });

  it("keeps the deal as it was when the value can't be stored", async () => {
    const { id } = await createDeal(t.db, { ...EMPTY_DEAL, title: "Gutters", value: "800" });
    expect((await updateDeal(t.db, id!, { ...EMPTY_DEAL, title: "Gutters", value: "-1" }, null))?.errors).toEqual({ value: "Enter an amount of 0 or more." });
    expect((await getDeal(t.db, id!))?.value).toBe("800.00");
  });

  it("returns null for a deal that isn't there", async () => {
    expect(await updateDeal(t.db, UNKNOWN, { ...EMPTY_DEAL, title: "Gutters" }, null)).toBeNull();
    expect(await updateDeal(t.db, "not-an-id", { ...EMPTY_DEAL, title: "Gutters" }, null)).toBeNull();
  });
});

describe("moving a deal to another stage", () => {
  it("changes only its stage, says where it came from, and moves it between the open figures", async () => {
    const { companyId, contactId } = await people();
    const { id } = await createDeal(t.db, { ...EMPTY_DEAL, title: "Gutters", value: "800", contactId, companyId });
    const before = (await getDeal(t.db, id!))!;
    expect(await openDealsTotal(t.db)).toEqual({ count: 1, total: "800.00" });

    expect(await moveDealStage(t.db, id!, "Proposal", null)).toEqual({ from: "New", to: "Proposal" });
    expect(await moveDealStage(t.db, id!, "Won", null)).toEqual({ from: "Proposal", to: "Won" });
    const after = (await getDeal(t.db, id!))!;
    expect(after).toMatchObject({ title: "Gutters", value: "800.00", stage: "Won", contactId, companyId });
    expect(after.updatedAt.getTime()).toBeGreaterThanOrEqual(before.updatedAt.getTime());
    expect(await openDealsTotal(t.db)).toEqual({ count: 0, total: "0" });
  });

  it("to the stage it is in changes nothing", async () => {
    const { id } = await createDeal(t.db, { ...EMPTY_DEAL, title: "Gutters", stage: "Contacted" });
    const before = (await getDeal(t.db, id!))!;
    expect(await moveDealStage(t.db, id!, "Contacted", null)).toEqual({ from: "Contacted", to: "Contacted" });
    expect((await getDeal(t.db, id!))!.updatedAt).toEqual(before.updatedAt);
  });

  it("refuses a stage that doesn't exist and a deal that isn't there", async () => {
    const { id } = await createDeal(t.db, { ...EMPTY_DEAL, title: "Gutters" });
    expect(await moveDealStage(t.db, id!, "Maybe", null)).toBeNull();
    expect(await moveDealStage(t.db, id!, "won", null)).toBeNull();
    expect(await moveDealStage(t.db, UNKNOWN, "Won", null)).toBeNull();
    expect(await moveDealStage(t.db, "not-an-id", "Won", null)).toBeNull();
    expect((await getDeal(t.db, id!))!.stage).toBe("New");
  });
});

describe("stage changes", () => {
  const timeline = async (id: string) =>
    (await listActivities(t.db, { type: "deal", id })).map((a) => [a.kind, a.body, a.who]);

  it("from the board are logged on the deal, newest first, by who moved it", async () => {
    await t.db.insert(user).values({ id: "u1", name: "Margery Kempe", email: "margery@example.com" });
    const { id } = await createDeal(t.db, { ...EMPTY_DEAL, title: "Gutters", stage: "Contacted" });
    await moveDealStage(t.db, id!, "Proposal", "u1");
    await moveDealStage(t.db, id!, "Won", null);
    expect(await timeline(id!)).toEqual([
      ["stage_change", "Moved from Proposal to Won", null],
      ["stage_change", "Moved from Contacted to Proposal", "Margery Kempe"],
    ]);
  });

  it("from the deal form are logged too, and saving without a new stage logs nothing", async () => {
    await t.db.insert(user).values({ id: "u1", name: "Margery Kempe", email: "margery@example.com" });
    const { id } = await createDeal(t.db, { ...EMPTY_DEAL, title: "Gutters" });
    expect(await timeline(id!)).toEqual([]); // adding a deal isn't a move
    await updateDeal(t.db, id!, { ...EMPTY_DEAL, title: "Gutters and downpipes" }, "u1");
    expect(await timeline(id!)).toEqual([]);
    await updateDeal(t.db, id!, { ...EMPTY_DEAL, title: "Gutters and downpipes", stage: "Lost" }, "u1");
    expect(await timeline(id!)).toEqual([["stage_change", "Moved from New to Lost", "Margery Kempe"]]);
  });

  it("aren't logged for a move to the same stage or a refused one", async () => {
    const { id } = await createDeal(t.db, { ...EMPTY_DEAL, title: "Gutters", stage: "Contacted" });
    await moveDealStage(t.db, id!, "Contacted", null);
    await moveDealStage(t.db, id!, "Maybe", null);
    await updateDeal(t.db, id!, { ...EMPTY_DEAL, title: "", stage: "Won" }, null);
    expect(await timeline(id!)).toEqual([]);
    expect((await getDeal(t.db, id!))!.lastActivityAt).toBeNull();
  });

  it("count as the deal's last activity", async () => {
    const { id } = await createDeal(t.db, { ...EMPTY_DEAL, title: "Gutters" });
    await moveDealStage(t.db, id!, "Contacted", null);
    const [logged] = await listActivities(t.db, { type: "deal", id: id! });
    expect((await getDeal(t.db, id!))!.lastActivityAt).toEqual(logged.createdAt);
  });
});

describe("deleting", () => {
  it("a deal removes only that deal", async () => {
    const { id } = await createDeal(t.db, { ...EMPTY_DEAL, title: "Gutters" });
    await createDeal(t.db, { ...EMPTY_DEAL, title: "Porch" });
    expect(await deleteDeal(t.db, id!)).toBe(true);
    expect(await getDeal(t.db, id!)).toBeNull();
    expect(await deleteDeal(t.db, UNKNOWN)).toBe(false);
    expect(await deleteDeal(t.db, "not-an-id")).toBe(false);
    expect((await listDeals(t.db)).map((d) => d.title)).toEqual(["Porch"]);
  });

  it("its contact or company keeps the deal, with none", async () => {
    const { companyId, contactId } = await people();
    const { id } = await createDeal(t.db, { ...EMPTY_DEAL, title: "Gutters", contactId, companyId });
    await deleteContact(t.db, contactId);
    await deleteCompany(t.db, companyId);
    expect(await getDeal(t.db, id!)).toMatchObject({ title: "Gutters", contactId: null, companyId: null, contactName: null, companyName: null });
  });
});

describe("the open deals total", () => {
  it("is nothing when there are no deals", async () => {
    expect(await openDealsTotal(t.db)).toEqual({ count: 0, total: "0" });
  });

  it("counts New, Contacted and Proposal deals and adds their values exactly", async () => {
    const add = (title: string, value: string, stage: string) => createDeal(t.db, { ...EMPTY_DEAL, title, value, stage });
    await add("New one", "0.10", "New");
    await add("Contacted one", "0.20", "Contacted");
    await add("Proposal one", "9999999999.99", "Proposal");
    await add("No value yet", "", "New");
    await add("Won one", "500", "Won");
    await add("Lost one", "700", "Lost");
    // 0.1 + 0.2 in floats is 0.30000000000000004; the database adds numerics
    expect(await openDealsTotal(t.db)).toEqual({ count: 4, total: "10000000000.29" });
  });

  it("follows a deal as it moves stage or goes", async () => {
    const { id } = await createDeal(t.db, { ...EMPTY_DEAL, title: "Gutters", value: "800" });
    await createDeal(t.db, { ...EMPTY_DEAL, title: "Porch", value: "200.50", stage: "Contacted" });
    expect(await openDealsTotal(t.db)).toEqual({ count: 2, total: "1000.50" });
    await updateDeal(t.db, id!, { ...EMPTY_DEAL, title: "Gutters", value: "800", stage: "Won" }, null);
    expect(await openDealsTotal(t.db)).toEqual({ count: 1, total: "200.50" });
    await createDeal(t.db, { ...EMPTY_DEAL, title: "Chimney", value: "99.50", stage: "Proposal" });
    expect(await openDealsTotal(t.db)).toEqual({ count: 2, total: "300.00" });
  });
});

describe("the contact picker's choices", () => {
  it("are every contact A to Z, with their company to tell them apart", async () => {
    await people();
    await createContact(t.db, { ...EMPTY_CONTACT, name: "Agnes Paston" });
    expect((await listContactChoices(t.db)).map(({ name, companyName }) => [name, companyName])).toEqual([
      ["Agnes Paston", null],
      ["Wat Tyler", "Lynn Tilers"],
    ]);
  });
});
