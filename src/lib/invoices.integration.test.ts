// I11: invoices are numbered from a sequence, copy the tax rate when made, and move Draft to Sent to Paid.
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestDb } from "@/test/db";
import type { Db } from "@/lib/db/client";
import { client, invoice, invoiceLine } from "@/lib/db/schema";
import { makeClient } from "./clients";
import { createCompany, EMPTY_COMPANY } from "./companies";
import { createDeal, EMPTY_DEAL } from "./deals";
import {
  advanceInvoice, createInvoice, deleteInvoice, getInvoice, listInvoices, listProjectChoices, NOT_DRAFT,
  NOT_THEIR_PROJECT, PICK_CLIENT, updateInvoice, type InvoiceInput,
} from "./invoices";
import { createProject, deleteProject } from "./projects";
import { getTaxRate, setTaxRate } from "./settings";

let t: { db: Db; close(): Promise<void> };
beforeEach(async () => { t = await createTestDb(); });
afterEach(() => t.close());

const MISSING = "6f1c2a3e-1d2b-4c5d-8e9f-0a1b2c3d4e5f";

// A client made the way the app makes one: a Won deal of a company.
async function newClient(name: string) {
  const companyId = (await createCompany(t.db, { ...EMPTY_COMPANY, name })).id!;
  const dealId = (await createDeal(t.db, { ...EMPTY_DEAL, title: `Work for ${name}`, stage: "Won", companyId })).id!;
  return (await makeClient(t.db, dealId))!.id!;
}

const newProject = async (clientId: string, name = "Oak staircase") =>
  (await createProject(t.db, { name, clientId, budget: "4500", startOn: "2026-10-01", endOn: "2026-12-01" })).id!;

const THREE_LINES = [
  { description: "Oak shelves", quantity: "3", unitPrice: "120" },
  { description: "Fitting, hours", quantity: "1.5", unitPrice: "85" },
  { description: "Brass brackets", quantity: "1", unitPrice: "42.50" },
];

const input = (clientId: string, fields: Partial<InvoiceInput> = {}): InvoiceInput =>
  ({ clientId, projectId: "", issueOn: "2026-10-12", dueOn: "2026-11-11", lines: THREE_LINES, ...fields });

const add = async (clientId: string, fields: Partial<InvoiceInput> = {}) => {
  const saved = await createInvoice(t.db, input(clientId, fields));
  if (saved.errors) throw new Error(JSON.stringify(saved.errors));
  return saved;
};

describe("the tax rate in Settings", () => {
  it("is 0 until set, then what was set", async () => {
    expect(await getTaxRate(t.db)).toBe("0.00");
    expect(await setTaxRate(t.db, "15%")).toEqual({ value: "15.00", error: null });
    expect(await getTaxRate(t.db)).toBe("15.00");
    await setTaxRate(t.db, "7.5");
    expect(await getTaxRate(t.db)).toBe("7.50");
  });

  it("refuses a rate it can't use and keeps the old one", async () => {
    await setTaxRate(t.db, "15");
    expect(await setTaxRate(t.db, "120")).toEqual({ value: null, error: "Enter a tax rate from 0 to 100." });
    expect(await getTaxRate(t.db)).toBe("15.00");
  });
});

describe("createInvoice", () => {
  it("makes a Draft with its lines in order, the tax rate copied on and the right totals", async () => {
    await setTaxRate(t.db, "15");
    const clientId = await newClient("Lee Plumbing");
    const { id, number } = await add(clientId);
    expect(number).toBe(1);
    const got = await getInvoice(t.db, id!);
    expect(got).toEqual(expect.objectContaining({
      id, number: 1, clientId, clientName: "Lee Plumbing", projectId: null, projectName: null,
      issueOn: "2026-10-12", dueOn: "2026-11-11", taxRate: "15.00", status: "Draft",
    }));
    expect(got!.lines).toEqual([
      { description: "Oak shelves", quantity: "3.00", unitPrice: "120.00" },
      { description: "Fitting, hours", quantity: "1.50", unitPrice: "85.00" },
      { description: "Brass brackets", quantity: "1.00", unitPrice: "42.50" },
    ]);
    expect(got!.totals).toEqual({ lines: ["360.00", "127.50", "42.50"], subtotal: "530.00", tax: "79.50", total: "609.50" });
  });

  it("keeps an invoice's tax rate when Settings change later", async () => {
    await setTaxRate(t.db, "15");
    const clientId = await newClient("Lee Plumbing");
    const { id } = await add(clientId);
    await setTaxRate(t.db, "20");
    await updateInvoice(t.db, id!, input(clientId, { dueOn: "2026-11-30" }));
    expect((await getInvoice(t.db, id!))!.taxRate).toBe("15.00");
    expect((await add(clientId)).id).not.toBe(id);
    expect((await listInvoices(t.db)).map((i) => i.taxRate)).toEqual(["20.00", "15.00"]);
  });

  it("can be for one of the client's projects, not another client's", async () => {
    const clientId = await newClient("Lee Plumbing");
    const otherId = await newClient("Fen Mill");
    const projectId = await newProject(clientId);
    const theirs = await newProject(otherId, "Mill doors");
    const { id } = await add(clientId, { projectId });
    expect(await getInvoice(t.db, id!)).toEqual(expect.objectContaining({ projectId, projectName: "Oak staircase" }));
    expect((await createInvoice(t.db, input(clientId, { projectId: theirs }))).errors).toEqual({ projectId: NOT_THEIR_PROJECT });
    expect((await createInvoice(t.db, input(clientId, { projectId: MISSING }))).errors).toEqual({ projectId: NOT_THEIR_PROJECT });
  });

  it("refuses a client that doesn't exist, and saves nothing when a field is wrong", async () => {
    expect((await createInvoice(t.db, input(MISSING))).errors).toEqual({ clientId: PICK_CLIENT });
    const clientId = await newClient("Lee Plumbing");
    expect((await createInvoice(t.db, input(clientId, { lines: [] }))).errors?.lines).toBeDefined();
    expect(await t.db.select().from(invoice)).toHaveLength(0);
  });
});

describe("numbering", () => {
  it("counts up from INV-0001 and never gives a number out twice, even after a delete", async () => {
    const clientId = await newClient("Lee Plumbing");
    const first = await add(clientId);
    const second = await add(clientId);
    expect([first.number, second.number]).toEqual([1, 2]);
    expect(await deleteInvoice(t.db, second.id!)).toBe(true);
    expect((await add(clientId)).number).toBe(3);
    // a refused invoice takes no number
    await createInvoice(t.db, input(clientId, { lines: [] }));
    expect((await add(clientId)).number).toBe(4);
  });

  it("is unique at the database, whoever writes", async () => {
    const clientId = await newClient("Lee Plumbing");
    await add(clientId);
    await expect(t.db.insert(invoice).values({ number: 1, clientId, issueOn: "2026-10-12", dueOn: "2026-10-12", taxRate: "0" }))
      .rejects.toThrow();
  });

  it("gives invoices made at the same moment different numbers", async () => {
    const clientId = await newClient("Lee Plumbing");
    const made = await Promise.all([1, 2, 3, 4].map(() => add(clientId)));
    expect(made.map((m) => m.number).sort()).toEqual([1, 2, 3, 4]);
  });
});

describe("statuses", () => {
  it("go Draft, then Sent, then Paid, one step at a time", async () => {
    const clientId = await newClient("Lee Plumbing");
    const { id } = await add(clientId);
    expect(await advanceInvoice(t.db, id!, "Paid")).toBe(false); // a Draft isn't marked paid
    expect(await advanceInvoice(t.db, id!, "Sent")).toBe(true);
    expect((await getInvoice(t.db, id!))!.status).toBe("Sent");
    expect(await advanceInvoice(t.db, id!, "Sent")).toBe(false); // twice from two tabs: the second does nothing
    expect(await advanceInvoice(t.db, id!, "Paid")).toBe(true);
    expect((await getInvoice(t.db, id!))!.status).toBe("Paid");
    expect(await advanceInvoice(t.db, id!, "Draft")).toBe(false); // never back
    expect(await advanceInvoice(t.db, id!, "Sent")).toBe(false);
    expect((await getInvoice(t.db, id!))!.status).toBe("Paid");
  });

  it("refuses no such invoice or status", async () => {
    expect(await advanceInvoice(t.db, MISSING, "Sent")).toBe(false);
    expect(await advanceInvoice(t.db, "not-an-id", "Sent")).toBe(false);
    const { id } = await add(await newClient("Lee Plumbing"));
    expect(await advanceInvoice(t.db, id!, "Lost")).toBe(false);
  });

  it("are held to the three at the database", async () => {
    const { id } = await add(await newClient("Lee Plumbing"));
    await expect(t.db.update(invoice).set({ status: "Void" as "Paid" }).where(eq(invoice.id, id!))).rejects.toThrow();
  });
});

describe("updateInvoice", () => {
  it("changes a Draft's client, project, dates and lines, keeping its number", async () => {
    const clientId = await newClient("Lee Plumbing");
    const otherId = await newClient("Fen Mill");
    const projectId = await newProject(otherId);
    const { id } = await add(clientId);
    const saved = await updateInvoice(t.db, id!, input(otherId, {
      projectId, issueOn: "2026-10-13", dueOn: "2026-10-27", lines: [{ description: "Doors", quantity: "2", unitPrice: "0.10" }],
    }));
    expect(saved).toEqual({ id, number: 1, errors: null });
    const got = await getInvoice(t.db, id!);
    expect(got).toEqual(expect.objectContaining({ clientId: otherId, projectId, issueOn: "2026-10-13", dueOn: "2026-10-27", number: 1 }));
    expect(got!.lines).toEqual([{ description: "Doors", quantity: "2.00", unitPrice: "0.10" }]);
    expect(await t.db.select().from(invoiceLine)).toHaveLength(1);
  });

  it("refuses a Sent or Paid invoice and leaves it as it was", async () => {
    const clientId = await newClient("Lee Plumbing");
    const { id } = await add(clientId);
    await advanceInvoice(t.db, id!, "Sent");
    expect(await updateInvoice(t.db, id!, input(clientId, { lines: [THREE_LINES[0]] })))
      .toEqual({ id: null, number: null, errors: { form: NOT_DRAFT } });
    expect((await getInvoice(t.db, id!))!.lines).toHaveLength(3);
  });

  it("returns null for no such invoice", async () => {
    const clientId = await newClient("Lee Plumbing");
    expect(await updateInvoice(t.db, MISSING, input(clientId))).toBeNull();
    expect(await updateInvoice(t.db, "nope", input(clientId))).toBeNull();
  });
});

describe("deleteInvoice", () => {
  it("deletes a Draft and its lines, never a Sent or Paid one", async () => {
    const clientId = await newClient("Lee Plumbing");
    const draft = await add(clientId);
    const sent = await add(clientId);
    await advanceInvoice(t.db, sent.id!, "Sent");
    expect(await deleteInvoice(t.db, sent.id!)).toBe(false);
    expect(await deleteInvoice(t.db, draft.id!)).toBe(true);
    expect(await getInvoice(t.db, draft.id!)).toBeNull();
    expect(await t.db.select().from(invoiceLine).where(eq(invoiceLine.invoiceId, draft.id!))).toHaveLength(0);
    expect(await getInvoice(t.db, sent.id!)).not.toBeNull();
    expect(await deleteInvoice(t.db, MISSING)).toBe(false);
  });
});

describe("reads", () => {
  it("list newest first with totals, or one client's or project's", async () => {
    const clientId = await newClient("Lee Plumbing");
    const otherId = await newClient("Fen Mill");
    const projectId = await newProject(clientId);
    const a = await add(clientId, { projectId });
    const b = await add(otherId, { lines: [{ description: "Doors", quantity: "1", unitPrice: "0.10" }, { description: "Hinges", quantity: "1", unitPrice: "0.20" }] });
    const c = await add(clientId);

    const all = await listInvoices(t.db);
    expect(all.map((i) => i.number)).toEqual([3, 2, 1]);
    expect(all[1]).toEqual(expect.objectContaining({ id: b.id, clientName: "Fen Mill", totals: expect.objectContaining({ subtotal: "0.30" }) }));
    expect((await listInvoices(t.db, { clientId })).map((i) => i.id)).toEqual([c.id, a.id]);
    expect((await listInvoices(t.db, { projectId })).map((i) => i.id)).toEqual([a.id]);
    expect(await listInvoices(t.db, { clientId: "nope" })).toEqual([]);
    expect(await getInvoice(t.db, "nope")).toBeNull();
  });

  it("keep an invoice when its project is deleted, without the project", async () => {
    const clientId = await newClient("Lee Plumbing");
    const projectId = await newProject(clientId);
    const { id } = await add(clientId, { projectId });
    await deleteProject(t.db, projectId);
    expect(await getInvoice(t.db, id!)).toEqual(expect.objectContaining({ projectId: null, projectName: null }));
  });

  it("offer every project with its client for the form's picker", async () => {
    const clientId = await newClient("Lee Plumbing");
    const projectId = await newProject(clientId, "Bench");
    expect(await listProjectChoices(t.db)).toEqual([{ id: projectId, name: "Bench", clientId }]);
  });

  it("keep a client with invoices from being deleted under them", async () => {
    const clientId = await newClient("Lee Plumbing");
    await add(clientId);
    await expect(t.db.delete(client).where(eq(client.id, clientId))).rejects.toThrow();
  });
});
