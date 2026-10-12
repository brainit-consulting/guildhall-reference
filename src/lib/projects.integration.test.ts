// I10: projects belong to a client, run Active then Done, and never end before they start.
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestDb } from "@/test/db";
import type { Db } from "@/lib/db/client";
import { client, project } from "@/lib/db/schema";
import { makeClient } from "./clients";
import { createCompany, EMPTY_COMPANY, updateCompany } from "./companies";
import { createDeal, EMPTY_DEAL } from "./deals";
import {
  createProject, deleteProject, ENDS_BEFORE_START, getProject, listClientProjects, listProjects, PICK_CLIENT,
  setProjectStatus, updateProject, type ProjectInput,
} from "./projects";

let t: { db: Db; close(): Promise<void> };
beforeEach(async () => { t = await createTestDb(); });
afterEach(() => t.close());

const MISSING = "6f1c2a3e-1d2b-4c5d-8e9f-0a1b2c3d4e5f";

// A client made the way the app makes one: a Won deal of a company.
async function newClient(name: string) {
  const companyId = (await createCompany(t.db, { ...EMPTY_COMPANY, name })).id!;
  const dealId = (await createDeal(t.db, { ...EMPTY_DEAL, title: `Work for ${name}`, stage: "Won", companyId })).id!;
  return { clientId: (await makeClient(t.db, dealId))!.id!, companyId };
}

const input = (clientId: string, fields: Partial<ProjectInput> = {}): ProjectInput =>
  ({ name: "Oak staircase", clientId, budget: "4500", startOn: "2026-10-12", endOn: "2026-11-20", ...fields });

const add = async (clientId: string, fields: Partial<ProjectInput> = {}) => (await createProject(t.db, input(clientId, fields))).id!;

describe("createProject", () => {
  it("adds an Active project with its client, exact budget and dates", async () => {
    const { clientId } = await newClient("Lee Plumbing");
    const id = await add(clientId);
    expect(await getProject(t.db, id)).toEqual(expect.objectContaining({
      id, name: "Oak staircase", clientId, clientName: "Lee Plumbing", status: "Active", budget: "4500.00",
      startOn: "2026-10-12", endOn: "2026-11-20",
    }));
  });

  it("refuses an end before the start and saves nothing", async () => {
    const { clientId } = await newClient("Lee Plumbing");
    const saved = await createProject(t.db, input(clientId, { endOn: "2026-10-11" }));
    expect(saved).toEqual({ id: null, errors: { endOn: ENDS_BEFORE_START } });
    expect(await t.db.select().from(project)).toHaveLength(0);
  });

  it("allows one that ends on the day it starts", async () => {
    const { clientId } = await newClient("Lee Plumbing");
    expect((await createProject(t.db, input(clientId, { endOn: "2026-10-12" }))).errors).toBeNull();
  });

  it("refuses a client that isn't there", async () => {
    expect(await createProject(t.db, input(MISSING))).toEqual({ id: null, errors: { clientId: PICK_CLIENT } });
  });
});

describe("the date rule in the database", () => {
  it("refuses an end before the start, whoever writes it", async () => {
    const { clientId } = await newClient("Lee Plumbing");
    await expect(t.db.insert(project).values({ name: "Shelves", clientId, budget: "1.00", startOn: "2026-10-12", endOn: "2026-10-11" }))
      .rejects.toThrow();
    const id = await add(clientId);
    await expect(t.db.update(project).set({ endOn: "2026-01-01" }).where(eq(project.id, id))).rejects.toThrow();
  });
});

describe("updateProject", () => {
  it("saves new fields and keeps the status", async () => {
    const { clientId } = await newClient("Lee Plumbing");
    const other = await newClient("Hart Builders");
    const id = await add(clientId);
    await setProjectStatus(t.db, id, "Done");
    expect(await updateProject(t.db, id, input(other.clientId, { name: "Oak stairs", budget: "5,000.5", endOn: "2026-12-01" })))
      .toEqual({ id, errors: null });
    expect(await getProject(t.db, id)).toEqual(expect.objectContaining({
      name: "Oak stairs", clientId: other.clientId, clientName: "Hart Builders", budget: "5000.50", endOn: "2026-12-01", status: "Done",
    }));
  });

  it("refuses an end before the start and leaves the project as it was", async () => {
    const { clientId } = await newClient("Lee Plumbing");
    const id = await add(clientId);
    expect(await updateProject(t.db, id, input(clientId, { startOn: "2026-12-01" }))).toEqual({ id: null, errors: { endOn: ENDS_BEFORE_START } });
    expect((await getProject(t.db, id))!.startOn).toBe("2026-10-12");
  });

  it("returns null for a project that isn't there", async () => {
    const { clientId } = await newClient("Lee Plumbing");
    expect(await updateProject(t.db, MISSING, input(clientId))).toBeNull();
    expect(await updateProject(t.db, "not-an-id", input(clientId))).toBeNull();
  });
});

describe("setProjectStatus", () => {
  it("marks a project done, and active again", async () => {
    const { clientId } = await newClient("Lee Plumbing");
    const id = await add(clientId);
    expect(await setProjectStatus(t.db, id, "Done")).toBe(true);
    expect((await getProject(t.db, id))!.status).toBe("Done");
    expect(await setProjectStatus(t.db, id, "Active")).toBe(true);
    expect((await getProject(t.db, id))!.status).toBe("Active");
  });

  it("refuses a status that isn't one and a project that isn't there", async () => {
    const { clientId } = await newClient("Lee Plumbing");
    const id = await add(clientId);
    expect(await setProjectStatus(t.db, id, "Paused")).toBe(false);
    expect(await setProjectStatus(t.db, MISSING, "Done")).toBe(false);
    expect((await getProject(t.db, id))!.status).toBe("Active");
  });
});

describe("deleteProject", () => {
  it("deletes the project and keeps the client", async () => {
    const { clientId } = await newClient("Lee Plumbing");
    const id = await add(clientId);
    expect(await deleteProject(t.db, id)).toBe(true);
    expect(await getProject(t.db, id)).toBeNull();
    expect(await t.db.select().from(client)).toHaveLength(1);
    expect(await deleteProject(t.db, id)).toBe(false);
  });
});

describe("listProjects", () => {
  it("lists Active first, then by start date and name, with the client's current name", async () => {
    const lee = await newClient("Lee Plumbing");
    const hart = await newClient("Hart Builders");
    const finished = await add(lee.clientId, { name: "Gate", startOn: "2026-01-05", endOn: "2026-01-09" });
    await setProjectStatus(t.db, finished, "Done");
    await add(hart.clientId, { name: "Porch", startOn: "2026-11-01", endOn: "2026-11-30" });
    await add(lee.clientId, { name: "bench", startOn: "2026-10-01", endOn: "2026-10-03" });
    await add(lee.clientId, { name: "Attic", startOn: "2026-10-01", endOn: "2026-10-03" });
    await updateCompany(t.db, lee.companyId, { ...EMPTY_COMPANY, name: "Lee & Daughters" });

    expect((await listProjects(t.db)).map((p) => [p.name, p.clientName, p.status])).toEqual([
      ["Attic", "Lee & Daughters", "Active"],
      ["bench", "Lee & Daughters", "Active"],
      ["Porch", "Hart Builders", "Active"],
      ["Gate", "Lee & Daughters", "Done"],
    ]);
  });

  it("lists one client's projects only", async () => {
    const lee = await newClient("Lee Plumbing");
    const hart = await newClient("Hart Builders");
    await add(lee.clientId, { name: "Stairs" });
    await add(hart.clientId, { name: "Porch" });
    expect((await listClientProjects(t.db, lee.clientId)).map((p) => p.name)).toEqual(["Stairs"]);
    expect(await listClientProjects(t.db, "not-an-id")).toEqual([]);
  });
});
