import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestDb } from "@/test/db";
import type { Db } from "@/lib/db/client";
import { company } from "@/lib/db/schema";
import { createCompany, deleteCompany, EMPTY_COMPANY, getCompany, listCompanies, updateCompany } from "./companies";

let t: { db: Db; close(): Promise<void> };
beforeEach(async () => { t = await createTestDb(); });
afterEach(() => t.close());

const LYNN = { name: "Lynn Tilers", website: "lynntilers.example", phone: "01553 774 100", notes: "Roofs for the guildhall." };
const UNKNOWN = "00000000-0000-4000-8000-000000000000";

describe("creating a company", () => {
  it("saves every field and reads it back", async () => {
    const { id, errors } = await createCompany(t.db, LYNN);
    expect(errors).toBeNull();
    expect(await getCompany(t.db, id!)).toMatchObject(LYNN);
  });

  it("saves nothing without a name", async () => {
    const result = await createCompany(t.db, { ...LYNN, name: " " });
    expect(result).toEqual({ id: null, errors: { name: "Enter a name." } });
    expect(await listCompanies(t.db)).toEqual([]);
  });

  it("lists companies newest first", async () => {
    await t.db.insert(company).values([
      { name: "Older", createdAt: new Date("2026-10-01T09:00:00Z") },
      { name: "Newer", createdAt: new Date("2026-10-09T09:00:00Z") },
    ]);
    await createCompany(t.db, { ...EMPTY_COMPANY, name: "Newest" });
    expect((await listCompanies(t.db)).map((c) => c.name)).toEqual(["Newest", "Newer", "Older"]);
  });
});

describe("updating a company", () => {
  it("changes the fields and clears the ones left blank", async () => {
    const { id } = await createCompany(t.db, LYNN);
    const before = (await getCompany(t.db, id!))!;
    const result = await updateCompany(t.db, id!, { ...EMPTY_COMPANY, name: "Lynn Tilers & Masons", website: "lynnmasons.example" });
    expect(result).toEqual({ id, errors: null });
    const after = (await getCompany(t.db, id!))!;
    expect(after).toMatchObject({ name: "Lynn Tilers & Masons", website: "lynnmasons.example", phone: null, notes: null });
    expect(after.createdAt).toEqual(before.createdAt);
    expect(after.updatedAt.getTime()).toBeGreaterThanOrEqual(before.updatedAt.getTime());
  });

  it("keeps the company as it was when the name is left blank", async () => {
    const { id } = await createCompany(t.db, LYNN);
    expect((await updateCompany(t.db, id!, { ...LYNN, name: "" }))?.errors).toEqual({ name: "Enter a name." });
    expect(await getCompany(t.db, id!)).toMatchObject(LYNN);
  });

  it("returns null for a company that isn't there", async () => {
    expect(await updateCompany(t.db, UNKNOWN, LYNN)).toBeNull();
    expect(await updateCompany(t.db, "not-an-id", LYNN)).toBeNull();
  });
});

describe("deleting a company", () => {
  it("removes only that company", async () => {
    const { id } = await createCompany(t.db, LYNN);
    await createCompany(t.db, { ...EMPTY_COMPANY, name: "Norwich Glaziers" });
    expect(await deleteCompany(t.db, id!)).toBe(true);
    expect(await getCompany(t.db, id!)).toBeNull();
    expect((await listCompanies(t.db)).map((c) => c.name)).toEqual(["Norwich Glaziers"]);
  });

  it("ignores an id that isn't a company", async () => {
    await createCompany(t.db, LYNN);
    expect(await deleteCompany(t.db, UNKNOWN)).toBe(false);
    expect(await deleteCompany(t.db, "not-an-id")).toBe(false);
    expect(await getCompany(t.db, "not-an-id")).toBeNull();
    expect(await listCompanies(t.db)).toHaveLength(1);
  });
});
