import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestDb } from "@/test/db";
import type { Db } from "@/lib/db/client";
import { deal, user } from "@/lib/db/schema";
import { listActivities } from "./activities";
import { createCompany, deleteCompany, EMPTY_COMPANY } from "./companies";
import { createContact, deleteContact, EMPTY_CONTACT, listContactChoices } from "./contacts";
import { TIME_ZONE, todayIn } from "./dates";
import {
  createDeal, deleteDeal, EMPTY_DEAL, getDeal, listDeals, listedDealsTotal, moveDealStage, openDealsTotal, readDealView, updateDeal,
  wonInMonth,
} from "./deals";
import type { SearchParams } from "./list-view";

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

describe("the day a deal was won", () => {
  // 11:30pm on 31 Oct in New York, when UTC is already in November
  const HALLOWEEN_NIGHT = new Date("2026-11-01T03:30:00Z");
  const NOV_3 = new Date("2026-11-03T15:00:00Z");
  const NOV_9 = new Date("2026-11-09T15:00:00Z");
  const wonOn = async (id: string) => (await getDeal(t.db, id))!.wonOn;

  it("is the business's today for a deal added at Won, and nothing for any other stage", async () => {
    const won = await createDeal(t.db, { ...EMPTY_DEAL, title: "Gutters", stage: "Won" }, HALLOWEEN_NIGHT);
    const open = await createDeal(t.db, { ...EMPTY_DEAL, title: "Porch", stage: "Proposal" }, HALLOWEEN_NIGHT);
    expect(await wonOn(won.id!)).toBe("2026-10-31");
    expect(await wonOn(open.id!)).toBeNull();
  });

  it("is set by a move to Won on the board, cleared by a move out, and set afresh by a move back", async () => {
    const { id } = await createDeal(t.db, { ...EMPTY_DEAL, title: "Gutters", stage: "Proposal" });
    await moveDealStage(t.db, id!, "Won", null, HALLOWEEN_NIGHT);
    expect(await wonOn(id!)).toBe("2026-10-31");
    await moveDealStage(t.db, id!, "Won", null, NOV_9); // already there: nothing changes
    expect(await wonOn(id!)).toBe("2026-10-31");
    await moveDealStage(t.db, id!, "Proposal", null, NOV_3);
    expect(await wonOn(id!)).toBeNull();
    await moveDealStage(t.db, id!, "Won", null, NOV_9);
    expect(await wonOn(id!)).toBe("2026-11-09");
  });

  it("is set by the form, kept when a Won deal is saved again, and cleared when it leaves Won", async () => {
    const { id } = await createDeal(t.db, { ...EMPTY_DEAL, title: "Gutters" });
    await updateDeal(t.db, id!, { ...EMPTY_DEAL, title: "Gutters" }, null, NOV_3); // edited, still New
    expect(await wonOn(id!)).toBeNull();
    await updateDeal(t.db, id!, { ...EMPTY_DEAL, title: "Gutters", stage: "Won" }, null, NOV_3);
    expect(await wonOn(id!)).toBe("2026-11-03");
    await updateDeal(t.db, id!, { ...EMPTY_DEAL, title: "Gutters and downpipes", value: "950", stage: "Won" }, null, NOV_9);
    expect(await wonOn(id!)).toBe("2026-11-03");
    await updateDeal(t.db, id!, { ...EMPTY_DEAL, title: "Gutters and downpipes", stage: "Lost" }, null, NOV_9);
    expect(await wonOn(id!)).toBeNull();
  });

  it("is kept by an added-at-Won deal saved again, and untouched by a refused save", async () => {
    const { id } = await createDeal(t.db, { ...EMPTY_DEAL, title: "Gutters", stage: "Won" }, NOV_3);
    await updateDeal(t.db, id!, { ...EMPTY_DEAL, title: "", stage: "New" }, null, NOV_9);
    expect(await wonOn(id!)).toBe("2026-11-03");
    await updateDeal(t.db, id!, { ...EMPTY_DEAL, title: "Gutters", stage: "Won" }, null, NOV_9);
    expect(await wonOn(id!)).toBe("2026-11-03");
  });

  it("defaults to the business's today", async () => {
    const { id } = await createDeal(t.db, { ...EMPTY_DEAL, title: "Gutters" });
    const before = todayIn(TIME_ZONE, new Date());
    await moveDealStage(t.db, id!, "Won", null);
    expect([before, todayIn(TIME_ZONE, new Date())]).toContain(await wonOn(id!));
  });
});

describe("the deals won in a month", () => {
  // Deals won on the first and last day of October, and either side of it.
  async function season() {
    const at = (iso: string) => new Date(iso);
    const add = (title: string, value: string, now: Date) => createDeal(t.db, { ...EMPTY_DEAL, title, value, stage: "Won" }, now);
    await add("Last of September", "1000", at("2026-10-01T03:30:00Z")); // 11:30pm on 30 Sep in New York
    await add("First of October", "0.10", at("2026-10-01T04:00:00Z")); // midnight in New York
    await add("Mid October", "", at("2026-10-15T12:00:00Z"));
    await add("Last of October", "0.20", at("2026-11-01T03:30:00Z"));
    await add("First of November", "500", at("2026-11-01T04:00:00Z"));
    const lost = await add("Won then lost", "700", at("2026-10-10T12:00:00Z"));
    await moveDealStage(t.db, lost.id!, "Lost", null);
    await createDeal(t.db, { ...EMPTY_DEAL, title: "Still open", value: "300", stage: "Proposal" });
  }

  it("counts the deals won from the month's first day to its last and adds their values exactly", async () => {
    await season();
    expect(await wonInMonth(t.db, "2026-10")).toEqual({ count: 3, total: "0.30" });
    expect(await wonInMonth(t.db, "2026-09")).toEqual({ count: 1, total: "1000.00" });
    expect(await wonInMonth(t.db, "2026-11")).toEqual({ count: 1, total: "500.00" });
    expect(await wonInMonth(t.db, "2026-12")).toEqual({ count: 0, total: "0" });
  });

  it("is nothing for something that isn't a month", async () => {
    await season();
    expect(await wonInMonth(t.db, "2026-13")).toEqual({ count: 0, total: "0" });
    expect(await wonInMonth(t.db, "junk")).toEqual({ count: 0, total: "0" });
  });

  it("are what the list shows for won=YYYY-MM, with the same figures; junk shows every deal", async () => {
    await season();
    const october = readDealView({ won: "2026-10", sort: "title" });
    expect((await listDeals(t.db, october)).map((d) => d.title)).toEqual(["First of October", "Last of October", "Mid October"]);
    expect(await listedDealsTotal(t.db, october)).toEqual(await wonInMonth(t.db, "2026-10"));
    expect(await listedDealsTotal(t.db, readDealView({ won: "2026-10", q: "last" }))).toEqual({ count: 1, total: "0.20" });
    expect(await listDeals(t.db, readDealView({ won: "junk" }))).toHaveLength(7);
    expect(await listDeals(t.db, readDealView({ won: "2026-13" }))).toHaveLength(7);
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

describe("searching, sorting and filtering the list", () => {
  const view = (params: SearchParams) => readDealView(params);
  const titles = async (params: SearchParams) => (await listDeals(t.db, view(params))).map((d) => d.title);

  // Five deals, one at each stage, with some blanks so every sort has something to put last. Added oldest first.
  async function ledger() {
    const acme = (await createCompany(t.db, { ...EMPTY_COMPANY, name: "ACME Roofing" })).id!;
    const lynn = (await createCompany(t.db, { ...EMPTY_COMPANY, name: "Lynn Tilers" })).id!;
    const wat = (await createContact(t.db, { ...EMPTY_CONTACT, name: "Wat Tyler", email: "wat@Acme.example" })).id!;
    const joan = (await createContact(t.db, { ...EMPTY_CONTACT, name: "Joan Acmeson" })).id!;
    const add = async (title: string, rest: Partial<typeof EMPTY_DEAL>, day: number) => {
      const { id } = await createDeal(t.db, { ...EMPTY_DEAL, title, ...rest });
      await t.db.update(deal).set({ createdAt: new Date(Date.UTC(2026, 8, day)) }).where(eq(deal.id, id!));
      return id!;
    };
    await add("Gutters", { value: "1000", stage: "Proposal", companyId: lynn, contactId: wat, expectedClose: "2026-12-01" }, 1);
    await add("re-roof the hall", { value: "900", stage: "New", companyId: acme, expectedClose: "2026-11-01" }, 2);
    await add("Chimney", { value: "", stage: "Won", contactId: joan }, 3);
    const porch = await add("Porch", { value: "50.25", stage: "Lost", companyId: lynn, expectedClose: "2027-01-15" }, 4);
    await add("Bell tower", { value: "20000", stage: "Contacted" }, 5);
    await t.db.update(deal).set({ lastActivityAt: new Date("2026-10-01T09:00:00Z") }).where(eq(deal.id, porch));
    await t.db.update(deal).set({ lastActivityAt: new Date("2026-10-05T09:00:00Z") }).where(eq(deal.title, "Gutters"));
  }

  it("with no view, or no sort, keeps today's order: newest first", async () => {
    await ledger();
    const newest = ["Bell tower", "Porch", "Chimney", "re-roof the hall", "Gutters"];
    expect((await listDeals(t.db)).map((d) => d.title)).toEqual(newest);
    expect(await titles({})).toEqual(newest);
  });

  it("searches the title, company name, contact name and contact email, ignoring capitals", async () => {
    await ledger();
    // company "ACME Roofing", contact email "wat@Acme.example", contact name "Joan Acmeson"
    expect(await titles({ q: "acme", sort: "title" })).toEqual(["Chimney", "Gutters", "re-roof the hall"]);
    expect(await titles({ q: "ROOF" })).toEqual(["re-roof the hall"]);
    expect(await titles({ q: "wat ty" })).toEqual(["Gutters"]);
    expect(await titles({ q: "50%" })).toEqual([]);
  });

  it("sorts titles and companies ignoring capitals, blanks last both ways", async () => {
    await ledger();
    expect(await titles({ sort: "title" })).toEqual(["Bell tower", "Chimney", "Gutters", "Porch", "re-roof the hall"]);
    expect(await titles({ sort: "title", dir: "desc" })).toEqual(["re-roof the hall", "Porch", "Gutters", "Chimney", "Bell tower"]);
    // ties on Lynn Tilers break by title; no company goes last
    expect(await titles({ sort: "company" })).toEqual(["re-roof the hall", "Gutters", "Porch", "Bell tower", "Chimney"]);
    expect(await titles({ sort: "company", dir: "desc" })).toEqual(["Gutters", "Porch", "re-roof the hall", "Bell tower", "Chimney"]);
  });

  it("sorts value as money, not as text, blanks last both ways", async () => {
    await ledger();
    // as text "1000.00" would come before "900.00"
    expect(await titles({ sort: "value" })).toEqual(["Porch", "re-roof the hall", "Gutters", "Bell tower", "Chimney"]);
    expect(await titles({ sort: "value", dir: "desc" })).toEqual(["Bell tower", "Gutters", "re-roof the hall", "Porch", "Chimney"]);
  });

  it("sorts stage in pipeline order", async () => {
    await ledger();
    const stages = async (params: SearchParams) => (await listDeals(t.db, view(params))).map((d) => d.stage);
    expect(await stages({ sort: "stage" })).toEqual(["New", "Contacted", "Proposal", "Won", "Lost"]);
    expect(await stages({ sort: "stage", dir: "desc" })).toEqual(["Lost", "Won", "Proposal", "Contacted", "New"]);
  });

  it("sorts expected close and last activity by date, blanks last both ways", async () => {
    await ledger();
    expect(await titles({ sort: "close" })).toEqual(["re-roof the hall", "Gutters", "Porch", "Bell tower", "Chimney"]);
    expect(await titles({ sort: "close", dir: "desc" })).toEqual(["Porch", "Gutters", "re-roof the hall", "Bell tower", "Chimney"]);
    expect(await titles({ sort: "activity" })).toEqual(["Porch", "Gutters", "Bell tower", "Chimney", "re-roof the hall"]);
    expect(await titles({ sort: "activity", dir: "desc" })).toEqual(["Gutters", "Porch", "Bell tower", "Chimney", "re-roof the hall"]);
  });

  it("filters by one stage, or to open deals only; an unknown stage is ignored", async () => {
    await ledger();
    expect(await titles({ stage: "Proposal" })).toEqual(["Gutters"]);
    expect(await titles({ open: "1", sort: "title" })).toEqual(["Bell tower", "Gutters", "re-roof the hall"]);
    expect(await titles({ stage: "Nope" })).toHaveLength(5);
  });

  it("combines search, filters and sort; Won with open only matches nothing", async () => {
    await ledger();
    expect(await titles({ q: "acme", open: "1", sort: "value", dir: "desc" })).toEqual(["Gutters", "re-roof the hall"]);
    expect(await titles({ q: "lynn", stage: "Lost", sort: "title" })).toEqual(["Porch"]);
    expect(await titles({ stage: "Won", open: "1" })).toEqual([]);
  });

  it("the open total follows the search and filters, and not the sort", async () => {
    await ledger();
    expect(await openDealsTotal(t.db)).toEqual({ count: 3, total: "21900.00" });
    expect(await openDealsTotal(t.db, view({}))).toEqual({ count: 3, total: "21900.00" });
    expect(await openDealsTotal(t.db, view({ q: "acme" }))).toEqual({ count: 2, total: "1900.00" });
    expect(await openDealsTotal(t.db, view({ stage: "Proposal" }))).toEqual({ count: 1, total: "1000.00" });
    expect(await openDealsTotal(t.db, view({ q: "lynn", open: "1" }))).toEqual({ count: 1, total: "1000.00" });
    expect(await openDealsTotal(t.db, view({ stage: "Won" }))).toEqual({ count: 0, total: "0" });
    expect(await openDealsTotal(t.db, view({ sort: "value", dir: "desc" }))).toEqual({ count: 3, total: "21900.00" });
  });
});
