// I10: "Make client" on a Won deal makes a client once per company (or contact) and links the deal to it.
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestDb } from "@/test/db";
import type { Db } from "@/lib/db/client";
import { client, deal } from "@/lib/db/schema";
import { getClient, listClients, listClientWonDeals, makeClient, NOBODY, NOT_WON } from "./clients";
import { createCompany, deleteCompany, EMPTY_COMPANY, updateCompany } from "./companies";
import { createContact, EMPTY_CONTACT } from "./contacts";
import { createDeal, EMPTY_DEAL, moveDealStage, type DealInput } from "./deals";

let t: { db: Db; close(): Promise<void> };
beforeEach(async () => { t = await createTestDb(); });
afterEach(() => t.close());

const now = new Date("2026-10-11T19:00:00Z");

async function people() {
  const companyId = (await createCompany(t.db, { ...EMPTY_COMPANY, name: "Lee Plumbing" })).id!;
  const contactId = (await createContact(t.db, { ...EMPTY_CONTACT, name: "Ann Lee", companyId })).id!;
  return { companyId, contactId };
}

const newDeal = async (fields: Partial<DealInput>) =>
  (await createDeal(t.db, { ...EMPTY_DEAL, title: "Kitchen refit", stage: "Won", ...fields }, now)).id!;

const clients = () => t.db.select().from(client);
const linkOf = async (dealId: string) =>
  (await t.db.select({ clientId: deal.clientId }).from(deal).where(eq(deal.id, dealId)))[0].clientId;

describe("makeClient", () => {
  it("makes a client from the deal's company, with its contact as the contact person, and links the deal", async () => {
    const { companyId, contactId } = await people();
    const dealId = await newDeal({ companyId, contactId });
    const made = await makeClient(t.db, dealId);
    expect(made).toEqual({ id: expect.any(String), created: true, error: null });
    expect(await clients()).toEqual([expect.objectContaining({ id: made!.id, name: "Lee Plumbing", madeFrom: "company", companyId, contactId })]);
    expect(await linkOf(dealId)).toBe(made!.id);
  });

  it("makes it once: pressed again on the same deal, it keeps the one client", async () => {
    const { companyId } = await people();
    const dealId = await newDeal({ companyId });
    const first = await makeClient(t.db, dealId);
    const again = await makeClient(t.db, dealId);
    expect(again).toEqual({ id: first!.id, created: false, error: null });
    expect(await clients()).toHaveLength(1);
  });

  it("reuses the company's client for its second Won deal", async () => {
    const { companyId, contactId } = await people();
    const first = await makeClient(t.db, await newDeal({ companyId, contactId }));
    const second = await newDeal({ title: "Bathroom", companyId });
    expect(await makeClient(t.db, second)).toEqual({ id: first!.id, created: false, error: null });
    expect(await clients()).toHaveLength(1);
    expect(await linkOf(second)).toBe(first!.id);
  });

  it("makes one client when two deals of a company are made clients at once", async () => {
    const { companyId } = await people();
    const a = await newDeal({ companyId });
    const b = await newDeal({ title: "Bathroom", companyId });
    const [ma, mb] = await Promise.all([makeClient(t.db, a), makeClient(t.db, b)]);
    expect(ma!.id).toBe(mb!.id);
    expect(await clients()).toHaveLength(1);
  });

  it("makes a client from the contact when the deal has no company, and reuses it for the contact's next deal", async () => {
    const contactId = (await createContact(t.db, { ...EMPTY_CONTACT, name: "Wat Tyler" })).id!;
    const first = await makeClient(t.db, await newDeal({ contactId }));
    expect(await clients()).toEqual([expect.objectContaining({ name: "Wat Tyler", madeFrom: "contact", companyId: null, contactId })]);
    expect((await makeClient(t.db, await newDeal({ title: "Porch", contactId })))!.id).toBe(first!.id);
    expect(await clients()).toHaveLength(1);
  });

  it("keeps a company's client apart from a client made from one of its contacts", async () => {
    const { companyId, contactId } = await people();
    const byContact = await makeClient(t.db, await newDeal({ contactId }));
    const byCompany = await makeClient(t.db, await newDeal({ title: "Bathroom", companyId, contactId }));
    expect(byCompany!.id).not.toBe(byContact!.id);
    // deleting the company leaves its client (now without one) beside the contact's
    expect(await deleteCompany(t.db, companyId)).toBe(true);
    expect(await clients()).toHaveLength(2);
  });

  it("refuses a deal that isn't Won, and one with no company or contact", async () => {
    const { companyId } = await people();
    expect(await makeClient(t.db, await newDeal({ stage: "Proposal", companyId }))).toEqual({ id: null, created: false, error: NOT_WON });
    expect(await makeClient(t.db, await newDeal({}))).toEqual({ id: null, created: false, error: NOBODY });
    expect(await clients()).toHaveLength(0);
  });

  it("answers null for no such deal", async () => {
    expect(await makeClient(t.db, "not-an-id")).toBeNull();
    expect(await makeClient(t.db, "00000000-0000-4000-8000-000000000000")).toBeNull();
  });
});

describe("reading clients", () => {
  it("lists each client A to Z with its contact person and its deals at Won", async () => {
    const { companyId, contactId } = await people();
    const a = await newDeal({ companyId, contactId });
    const b = await newDeal({ title: "Bathroom", companyId });
    const id = (await makeClient(t.db, a))!.id!;
    await makeClient(t.db, b);
    const other = (await createContact(t.db, { ...EMPTY_CONTACT, name: "Agnes Paston" })).id!;
    await makeClient(t.db, await newDeal({ title: "Shelves", contactId: other }));

    expect(await listClients(t.db)).toEqual([
      { id: expect.any(String), name: "Agnes Paston", contactId: other, contactName: "Agnes Paston", wonDeals: 1 },
      { id, name: "Lee Plumbing", contactId, contactName: "Ann Lee", wonDeals: 2 },
    ]);

    // a linked deal moved out of Won stays linked but stops counting
    await moveDealStage(t.db, b, "Lost", null, now);
    expect((await listClients(t.db)).find((c) => c.id === id)!.wonDeals).toBe(1);
    expect((await listClientWonDeals(t.db, id)).map((d) => d.title)).toEqual(["Kitchen refit"]);
  });

  it("shows the company's current name, and the one it was made with once the company is deleted", async () => {
    const { companyId, contactId } = await people();
    const id = (await makeClient(t.db, await newDeal({ companyId, contactId })))!.id!;
    await updateCompany(t.db, companyId, { ...EMPTY_COMPANY, name: "Lee & Daughters" });
    expect(await getClient(t.db, id)).toEqual(expect.objectContaining({
      name: "Lee & Daughters", companyId, companyName: "Lee & Daughters", contactId, contactName: "Ann Lee",
    }));
    await deleteCompany(t.db, companyId);
    expect(await getClient(t.db, id)).toEqual(expect.objectContaining({ name: "Lee Plumbing", companyId: null, companyName: null }));
  });

  it("answers null or nothing for no such client", async () => {
    expect(await getClient(t.db, "nope")).toBeNull();
    expect(await getClient(t.db, "00000000-0000-4000-8000-000000000000")).toBeNull();
    expect(await listClientWonDeals(t.db, "nope")).toEqual([]);
  });
});
