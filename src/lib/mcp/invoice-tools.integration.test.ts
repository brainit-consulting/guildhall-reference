// I12: the agent's invoicing tools: find the client and its projects, read an invoice, and draft one for the owner to
// check. The draft tool only ever makes a Draft, and records it in the agent log.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestDb } from "@/test/db";
import type { Db } from "@/lib/db/client";
import { agentLog, client, invoice, invoiceLine, project, user } from "@/lib/db/schema";
import { listAgentLog } from "@/lib/agent-log";
import { makeClient } from "@/lib/clients";
import { createCompany, EMPTY_COMPANY } from "@/lib/companies";
import { createContact, EMPTY_CONTACT } from "@/lib/contacts";
import { createDeal, EMPTY_DEAL } from "@/lib/deals";
import { advanceInvoice, createInvoice, getInvoice } from "@/lib/invoices";
import { createProject, setProjectStatus } from "@/lib/projects";
import { setTaxRate } from "@/lib/settings";
import { getInvoiceRecord, listClientsFor, listProjectsFor } from "./read-tools";
import { createInvoiceDraft, READ_ONLY_REFUSAL, type Agent } from "./write-tools";

const APP = "http://localhost:3000";
// 12 Oct 2026, midday in the business's time zone
const NOW = new Date("2026-10-12T12:00:00Z");
const UNKNOWN = "00000000-0000-4000-8000-000000000000";

let t: { db: Db; close(): Promise<void> };
let agent: Agent;
let readOnly: Agent;
beforeEach(async () => {
  t = await createTestDb();
  await t.db.insert(user).values({ id: "owner-1", name: "Margery Kempe", email: "owner@example.com" });
  agent = { clientId: "claude-client", name: "Claude", userId: "owner-1", canChange: true };
  readOnly = { ...agent, canChange: false };
});
afterEach(() => t.close());

// A client made the way the app makes one: a Won deal of a company, with a contact person.
async function newClient(name: string, person?: string) {
  const companyId = (await createCompany(t.db, { ...EMPTY_COMPANY, name })).id!;
  const contactId = person ? (await createContact(t.db, { ...EMPTY_CONTACT, name: person, companyId })).id! : null;
  const dealId = (await createDeal(t.db, { ...EMPTY_DEAL, title: `Work for ${name}`, stage: "Won", companyId, contactId: contactId ?? "" })).id!;
  return (await makeClient(t.db, dealId))!.id!;
}

const newProject = async (clientId: string, name: string, startOn = "2026-03-01") =>
  (await createProject(t.db, { name, clientId, budget: "4500", startOn, endOn: "2026-12-01" })).id!;

async function snapshot() {
  return Promise.all([
    t.db.select().from(client), t.db.select().from(project), t.db.select().from(invoice), t.db.select().from(invoiceLine),
    t.db.select().from(agentLog),
  ]);
}

describe("list_clients", () => {
  it("lists every client A to Z with its contact person, or those whose name holds the query, any capitals", async () => {
    const acme = await newClient("Acme Joinery", "Ada Lovelace");
    await newClient("Brook Farm");
    expect((await listClientsFor(t.db)).map((c) => c.name)).toEqual(["Acme Joinery", "Brook Farm"]);
    const before = await snapshot();
    expect(await listClientsFor(t.db, " acme ")).toEqual([
      { id: acme, name: "Acme Joinery", contact: { id: expect.any(String), name: "Ada Lovelace" }, wonDeals: 1 },
    ]);
    expect(await listClientsFor(t.db, "nobody")).toEqual([]);
    expect(await snapshot()).toEqual(before);
  });
});

describe("list_projects", () => {
  it("lists projects Active first, filtered to one client or one status when asked", async () => {
    const acme = await newClient("Acme Joinery");
    const brook = await newClient("Brook Farm");
    const march = await newProject(acme, "March fit-out", "2026-03-01");
    const done = await newProject(acme, "Old porch", "2026-01-01");
    await setProjectStatus(t.db, done, "Done");
    await newProject(brook, "Barn doors", "2026-04-01");

    const before = await snapshot();
    expect((await listProjectsFor(t.db)).map((p) => p.name)).toEqual(["March fit-out", "Barn doors", "Old porch"]);
    expect(await listProjectsFor(t.db, { client_id: acme, status: "Active" })).toEqual([{
      id: march, name: "March fit-out", status: "Active", client: { id: acme, name: "Acme Joinery" },
      budget: { amount: 4500, formatted: "$4,500.00" }, startOn: "2026-03-01", endOn: "2026-12-01",
    }]);
    expect((await listProjectsFor(t.db, { status: "Done" })).map((p) => p.name)).toEqual(["Old porch"]);
    expect(await listProjectsFor(t.db, { client_id: UNKNOWN })).toEqual([]);
    expect(await listProjectsFor(t.db, { client_id: "not-an-id" })).toEqual([]);
    expect(await snapshot()).toEqual(before);
  });
});

describe("get_invoice", () => {
  it("reads an invoice by ID or by number, with its lines, totals and page address", async () => {
    await setTaxRate(t.db, "15");
    const acme = await newClient("Acme Joinery");
    const march = await newProject(acme, "March fit-out");
    const saved = await createInvoice(t.db, {
      clientId: acme, projectId: march, issueOn: "2026-10-12", dueOn: "2026-11-11",
      lines: [{ description: "Joinery, hours", quantity: "10", unitPrice: "85" }],
    });
    const before = await snapshot();
    const record = await getInvoiceRecord(t.db, saved.id!, APP);
    expect(record).toEqual({
      id: saved.id, number: "INV-0001", status: "Draft", client: { id: acme, name: "Acme Joinery" },
      project: { id: march, name: "March fit-out" }, issueOn: "2026-10-12", dueOn: "2026-11-11", taxRate: "15%",
      lines: [{
        description: "Joinery, hours", quantity: 10, unitPrice: { amount: 85, formatted: "$85.00" },
        amount: { amount: 850, formatted: "$850.00" },
      }],
      subtotal: { amount: 850, formatted: "$850.00" }, tax: { amount: 127.5, formatted: "$127.50" },
      total: { amount: 977.5, formatted: "$977.50" }, page: `${APP}/invoices/${saved.id}`,
    });
    for (const asked of ["INV-0001", "inv-1", " INV 0001 ", "#1", "1"]) {
      expect((await getInvoiceRecord(t.db, asked, APP))?.id, asked).toBe(saved.id);
    }
    expect(await snapshot()).toEqual(before);
  });

  it("is null for an ID or number that matches nothing", async () => {
    for (const asked of [UNKNOWN, "INV-0002", "0", "99999999999", "not an invoice", ""]) {
      expect(await getInvoiceRecord(t.db, asked, APP), asked).toBeNull();
    }
  });
});

describe("create_invoice_draft", () => {
  it("drafts 10 hours at 85 an hour for a client's project, answers the number, totals and page, and logs it", async () => {
    await setTaxRate(t.db, "15");
    const acme = await newClient("Acme Joinery");
    const march = await newProject(acme, "March fit-out");
    const result = await createInvoiceDraft(t.db, agent, {
      client_id: acme, project_id: march, lines: [{ description: "March work, hours", quantity: 10, unit_price: 85 }],
    }, APP, NOW);
    expect(result.ok).toBe(true);
    const id = result.ok ? result.id! : "";
    expect(result.text).toBe(
      "Drafted INV-0001 for 'Acme Joinery': $850.00 plus $127.50 tax, $977.50 in all, due 11 Nov 2026. "
      + `It is a Draft: the owner checks it and sends it at ${APP}/invoices/${id}. ID ${id}.`,
    );

    const made = (await getInvoice(t.db, id))!;
    expect(made).toMatchObject({
      status: "Draft", clientId: acme, projectId: march, issueOn: "2026-10-12", dueOn: "2026-11-11", taxRate: "15.00",
      lines: [{ description: "March work, hours", quantity: "10.00", unitPrice: "85.00" }],
      totals: { subtotal: "850.00", tax: "127.50", total: "977.50" },
    });

    // the log keeps the summary without the address or ID, linked to the invoice by its number
    const [entry] = (await listAgentLog(t.db)).entries;
    expect(entry).toMatchObject({
      agentName: "Claude", person: "Margery Kempe", tool: "create_invoice_draft",
      summary: "Drafted INV-0001 for 'Acme Joinery': $850.00 plus $127.50 tax, $977.50 in all, due 11 Nov 2026.",
      record: { type: "invoice", id, name: "INV-0001" },
    });
  });

  it("takes figures as text, a due date, and no project", async () => {
    const acme = await newClient("Acme Joinery");
    const result = await createInvoiceDraft(t.db, agent, {
      client_id: acme, due_date: "2026-10-31",
      lines: [{ description: "Oak shelves", quantity: "3", unit_price: "$120.50" }, { description: "Fitting", quantity: "1.5", unit_price: "85" }],
    }, APP, NOW);
    expect(result.text).toMatch(/^Drafted INV-0001 for 'Acme Joinery': \$489\.00 plus \$0\.00 tax, \$489\.00 in all, due 31 Oct 2026. /);
    const [row] = await t.db.select().from(invoice);
    expect(row).toMatchObject({ status: "Draft", projectId: null, dueOn: "2026-10-31" });
  });

  it("only ever makes a Draft, and each one is a new invoice", async () => {
    const acme = await newClient("Acme Joinery");
    // a sent invoice is left as it is
    const sent = (await createInvoice(t.db, {
      clientId: acme, projectId: "", issueOn: "2026-10-01", dueOn: "2026-10-31", lines: [{ description: "Gate", quantity: "1", unitPrice: "300" }],
    })).id!;
    await advanceInvoice(t.db, sent, "Sent");
    const input = { client_id: acme, lines: [{ description: "Gate", quantity: 1, unit_price: 300 }] };
    // anything extra an agent sends, such as a status, isn't part of the tool and changes nothing
    await createInvoiceDraft(t.db, agent, { ...input, status: "Paid" } as typeof input, APP, NOW);
    await createInvoiceDraft(t.db, agent, input, APP, NOW);
    const rows = await t.db.select({ id: invoice.id, number: invoice.number, status: invoice.status }).from(invoice);
    expect(rows.map((r) => [r.number, r.status]).sort()).toEqual([[1, "Sent"], [2, "Draft"], [3, "Draft"]]);
  });

  it("refuses a Read only agent, making nothing and logging nothing", async () => {
    const acme = await newClient("Acme Joinery");
    const before = await snapshot();
    expect(await createInvoiceDraft(t.db, readOnly, { client_id: acme, lines: [{ description: "Gate", quantity: 1, unit_price: 300 }] }, APP, NOW))
      .toEqual({ ok: false, text: READ_ONLY_REFUSAL });
    expect(await snapshot()).toEqual(before);
  });

  it("says what is wrong, line by line, and makes nothing", async () => {
    const acme = await newClient("Acme Joinery");
    const brook = await newClient("Brook Farm");
    const barn = await newProject(brook, "Barn doors");
    const before = await snapshot();
    const draft = (input: Partial<Parameters<typeof createInvoiceDraft>[2]>) => createInvoiceDraft(t.db, agent, {
      client_id: acme, lines: [{ description: "Gate", quantity: 1, unit_price: 300 }], ...input,
    }, APP, NOW);

    expect(await draft({ client_id: UNKNOWN })).toEqual({
      ok: false, text: "Pick a client. Find the client's ID with list_clients. Nothing was made.",
    });
    expect(await draft({ project_id: barn })).toEqual({
      ok: false, text: "Pick one of this client's projects, or no project. Find its projects with list_projects. Nothing was made.",
    });
    expect(await draft({ due_date: "2026-10-01" })).toEqual({
      ok: false, text: "The due date can't be before the issue date. Nothing was made.",
    });
    expect(await draft({ due_date: "next Friday" })).toEqual({ ok: false, text: "Enter a date, like 12 Oct 2026. Nothing was made." });
    expect(await draft({
      lines: [{ description: "Gate", quantity: 0, unit_price: 300 }, { description: "", quantity: 1, unit_price: "85.555" }],
    })).toEqual({
      ok: false,
      text: "Line 1: Enter a quantity above 0. Line 2: Enter what this line is for. Line 2: Enter at most two decimals, like 1250.50. Nothing was made.",
    });
    expect(await draft({ lines: [] })).toEqual({
      ok: false, text: "Add at least one line: a description, a quantity and a unit price. Nothing was made.",
    });
    expect(await snapshot()).toEqual(before);
  });
});
