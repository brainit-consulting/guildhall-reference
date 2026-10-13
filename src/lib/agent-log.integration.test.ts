import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createTestDb } from "@/test/db";
import type { Db } from "@/lib/db/client";
import { eq } from "drizzle-orm";
import { agentLog, invoice, user } from "@/lib/db/schema";
import { makeClient } from "@/lib/clients";
import { createContact, EMPTY_CONTACT } from "@/lib/contacts";
import { createDeal, deleteDeal, EMPTY_DEAL } from "@/lib/deals";
import { createInvoice, deleteInvoice } from "@/lib/invoices";
import { AGENT_LOG_PAGE_SIZE, MAX_AGENT_LOG_PAGE, listAgentLog, listLoggedAgents, recordAgentChange } from "./agent-log";

let t: { db: Db; close(): Promise<void> };
beforeEach(async () => {
  t = await createTestDb();
  await t.db.insert(user).values({ id: "owner-1", name: "Emile", email: "owner@example.com" });
});
afterEach(() => t.close());

const CLAUDE = { clientId: "claude-client", name: "Claude" };
const INSPECTOR = { clientId: "inspector-client", name: "MCP Inspector" };

// `n` entries, a minute apart, the last the newest.
async function fill(n: number, agent = CLAUDE, start = Date.UTC(2026, 9, 12, 9)) {
  await t.db.insert(agentLog).values(Array.from({ length: n }, (_, i) => ({
    clientId: agent.clientId, agentName: agent.name, userId: "owner-1", tool: "log_activity",
    summary: `Change ${i + 1}`, createdAt: new Date(start + i * 60_000),
  })));
}

describe("listAgentLog", () => {
  it("reads a recorded change with the person's name and the record it touched", async () => {
    const dealId = (await createDeal(t.db, { ...EMPTY_DEAL, title: "Acme fit-out", stage: "Won" })).id!;
    await recordAgentChange(t.db, CLAUDE, {
      userId: "owner-1", tool: "move_deal_stage", summary: "Moved 'Acme fit-out' from Proposal to Won.",
      touched: { type: "deal", id: dealId },
    });
    const { entries, more } = await listAgentLog(t.db);
    expect(more).toBe(false);
    expect(entries).toMatchObject([{
      agentName: "Claude", person: "Emile", tool: "move_deal_stage", summary: "Moved 'Acme fit-out' from Proposal to Won.",
      record: { type: "deal", id: dealId, name: "Acme fit-out" },
    }]);
  });

  it("keeps the entry but drops the link once the record is deleted", async () => {
    const dealId = (await createDeal(t.db, { ...EMPTY_DEAL, title: "Acme fit-out" })).id!;
    await recordAgentChange(t.db, CLAUDE, { userId: "owner-1", tool: "log_activity", summary: "Logged", touched: { type: "deal", id: dealId } });
    await deleteDeal(t.db, dealId);
    expect((await listAgentLog(t.db)).entries).toMatchObject([{ summary: "Logged", record: null }]);
  });

  it("names an invoice by its number, past INV-9999 too, and drops the link once the Draft is deleted", async () => {
    const contactId = (await createContact(t.db, { ...EMPTY_CONTACT, name: "Ada Lovelace" })).id!;
    const dealId = (await createDeal(t.db, { ...EMPTY_DEAL, title: "Acme fit-out", stage: "Won", contactId })).id!;
    const clientId = (await makeClient(t.db, dealId))!.id!;
    const invoiceId = (await createInvoice(t.db, {
      clientId, projectId: "", issueOn: "2026-10-12", dueOn: "2026-11-11", lines: [{ description: "Gate", quantity: "1", unitPrice: "300" }],
    })).id!;
    await t.db.update(invoice).set({ number: 12345 }).where(eq(invoice.id, invoiceId));
    await recordAgentChange(t.db, CLAUDE, {
      userId: "owner-1", tool: "create_invoice_draft", summary: "Drafted", touched: { type: "invoice", id: invoiceId },
    });
    expect((await listAgentLog(t.db)).entries).toMatchObject([{ record: { type: "invoice", id: invoiceId, name: "INV-12345" } }]);
    await deleteInvoice(t.db, invoiceId);
    expect((await listAgentLog(t.db)).entries).toMatchObject([{ summary: "Drafted", record: null }]);
  });

  it("keeps the entry, without a name, once the person is removed", async () => {
    await fill(1);
    await t.db.delete(user);
    expect((await listAgentLog(t.db)).entries).toMatchObject([{ summary: "Change 1", person: null }]);
  });

  it("is newest first, 50 a page", async () => {
    await fill(AGENT_LOG_PAGE_SIZE + 2);
    const first = await listAgentLog(t.db);
    expect(first.entries).toHaveLength(AGENT_LOG_PAGE_SIZE);
    expect(first.more).toBe(true);
    expect(first.entries[0].summary).toBe("Change 52");
    const second = await listAgentLog(t.db, { page: 2 });
    expect(second.entries.map((e) => e.summary)).toEqual(["Change 2", "Change 1"]);
    expect(second.more).toBe(false);
  });

  it("reads page 1 for a page that isn't a whole number above 0", async () => {
    await fill(2);
    for (const page of [0, -1, 1.5, NaN, 1e20, Number.MAX_SAFE_INTEGER, MAX_AGENT_LOG_PAGE + 1]) {
      expect((await listAgentLog(t.db, { page })).entries[0].summary, String(page)).toBe("Change 2");
    }
  });

  it("reads the highest allowed page without an error", async () => {
    await fill(1);
    expect(await listAgentLog(t.db, { page: MAX_AGENT_LOG_PAGE })).toEqual({ entries: [], more: false });
  });

  it("filters by agent", async () => {
    await fill(2);
    await fill(1, INSPECTOR);
    expect((await listAgentLog(t.db, { clientId: INSPECTOR.clientId })).entries).toMatchObject([{ agentName: "MCP Inspector" }]);
    expect((await listAgentLog(t.db, { clientId: CLAUDE.clientId })).entries).toHaveLength(2);
    expect((await listAgentLog(t.db, { clientId: "no-such-agent" })).entries).toEqual([]);
  });
});

describe("listLoggedAgents", () => {
  it("lists each agent once, A to Z, under the name it last recorded", async () => {
    await fill(1, { ...INSPECTOR, name: "Old name" }, Date.UTC(2026, 0, 1));
    await fill(2, INSPECTOR);
    await fill(1);
    expect(await listLoggedAgents(t.db)).toEqual([CLAUDE, INSPECTOR]);
  });

  it("is empty before any agent changes anything", async () => {
    expect(await listLoggedAgents(t.db)).toEqual([]);
  });
});
