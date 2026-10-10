import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestDb } from "@/test/db";
import type { Db } from "@/lib/db/client";
import { contact } from "@/lib/db/schema";
import { createCompany, EMPTY_COMPANY } from "./companies";
import { createContact, deleteContact, EMPTY_CONTACT, getContact, listContacts, updateContact } from "./contacts";

let t: { db: Db; close(): Promise<void> };
beforeEach(async () => { t = await createTestDb(); });
afterEach(() => t.close());

const WAT = { name: "Wat Tyler", email: "wat@lynn.example", phone: "01553 774 100", jobTitle: "Master tiler", notes: "Roofs for the guildhall.", companyId: "" };
const UNKNOWN = "00000000-0000-4000-8000-000000000000";

describe("creating a contact", () => {
  it("saves every field and reads it back", async () => {
    const { id, errors } = await createContact(t.db, WAT);
    expect(errors).toBeNull();
    expect(await getContact(t.db, id!)).toMatchObject({ ...WAT, companyId: null, companyName: null });
  });

  it("saves nothing when the form has a problem", async () => {
    const result = await createContact(t.db, { ...WAT, name: "", email: "wat-at-lynn" });
    expect(result.id).toBeNull();
    expect(Object.keys(result.errors!)).toEqual(["name", "email"]);
    expect(await listContacts(t.db)).toEqual([]);
  });

  it("lists contacts newest first", async () => {
    await t.db.insert(contact).values([
      { name: "Older", createdAt: new Date("2026-10-01T09:00:00Z") },
      { name: "Newer", createdAt: new Date("2026-10-09T09:00:00Z") },
    ]);
    await createContact(t.db, { ...EMPTY_CONTACT, name: "Newest" });
    expect((await listContacts(t.db)).map((c) => c.name)).toEqual(["Newest", "Newer", "Older"]);
  });
});

describe("updating a contact", () => {
  it("changes the fields and clears the ones left blank", async () => {
    const { id } = await createContact(t.db, WAT);
    const before = (await getContact(t.db, id!))!;
    const result = await updateContact(t.db, id!, { ...EMPTY_CONTACT, name: "Wat Tyler", jobTitle: "Mason" });
    expect(result).toEqual({ id, errors: null });
    const after = (await getContact(t.db, id!))!;
    expect(after).toMatchObject({ name: "Wat Tyler", email: null, phone: null, jobTitle: "Mason", notes: null });
    expect(after.createdAt).toEqual(before.createdAt);
    expect(after.updatedAt.getTime()).toBeGreaterThanOrEqual(before.updatedAt.getTime());
  });

  it("keeps the contact as it was when the form has a problem", async () => {
    const { id } = await createContact(t.db, WAT);
    expect((await updateContact(t.db, id!, { ...WAT, email: "wat-at-lynn" }))?.errors).toHaveProperty("email");
    expect(await getContact(t.db, id!)).toMatchObject({ ...WAT, companyId: null });
  });

  it("returns null for a contact that isn't there", async () => {
    expect(await updateContact(t.db, UNKNOWN, WAT)).toBeNull();
    expect(await updateContact(t.db, "not-an-id", WAT)).toBeNull();
  });
});

describe("deleting a contact", () => {
  it("removes only that contact", async () => {
    const { id } = await createContact(t.db, WAT);
    await createContact(t.db, { ...EMPTY_CONTACT, name: "Margery Kempe" });
    expect(await deleteContact(t.db, id!)).toBe(true);
    expect(await getContact(t.db, id!)).toBeNull();
    expect((await listContacts(t.db)).map((c) => c.name)).toEqual(["Margery Kempe"]);
  });

  it("ignores an id that isn't a contact", async () => {
    await createContact(t.db, WAT);
    expect(await deleteContact(t.db, UNKNOWN)).toBe(false);
    expect(await deleteContact(t.db, "not-an-id")).toBe(false);
    expect(await getContact(t.db, "not-an-id")).toBeNull();
    expect(await listContacts(t.db)).toHaveLength(1);
  });
});

describe("a contact's company", () => {
  async function lynn() {
    return (await createCompany(t.db, { ...EMPTY_COMPANY, name: "Lynn Tilers" })).id!;
  }

  it("is saved with the contact and read back with its name, in the list too", async () => {
    const companyId = await lynn();
    const { id } = await createContact(t.db, { ...WAT, companyId });
    expect(await getContact(t.db, id!)).toMatchObject({ companyId, companyName: "Lynn Tilers" });
    await createContact(t.db, { ...EMPTY_CONTACT, name: "Margery Kempe" });
    expect((await listContacts(t.db)).map((c) => [c.name, c.companyName])).toEqual([
      ["Margery Kempe", null],
      ["Wat Tyler", "Lynn Tilers"],
    ]);
  });

  it("can be changed and taken away", async () => {
    const first = await lynn();
    const second = (await createCompany(t.db, { ...EMPTY_COMPANY, name: "Norwich Masons" })).id!;
    const { id } = await createContact(t.db, { ...WAT, companyId: first });
    await updateContact(t.db, id!, { ...WAT, companyId: second });
    expect(await getContact(t.db, id!)).toMatchObject({ companyId: second, companyName: "Norwich Masons" });
    await updateContact(t.db, id!, { ...WAT, companyId: "" });
    expect(await getContact(t.db, id!)).toMatchObject({ companyId: null, companyName: null });
  });

  it("must still be there: a company deleted while the form was open is explained, and nothing is saved", async () => {
    const gone = { companyId: "That company isn't in Guildhall any more. Pick another, or No company." };
    expect(await createContact(t.db, { ...WAT, companyId: UNKNOWN })).toEqual({ id: null, errors: gone });
    expect(await listContacts(t.db)).toEqual([]);

    const { id } = await createContact(t.db, WAT);
    expect(await updateContact(t.db, id!, { ...WAT, name: "Changed", companyId: UNKNOWN })).toEqual({ id: null, errors: gone });
    expect(await getContact(t.db, id!)).toMatchObject({ name: "Wat Tyler", companyId: null });
  });
});
