// The endpoint end to end over a test database: what an agent sees when it connects, with and without signing in.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestDb } from "@/test/db";
import { ALL_SCOPES, connectAgent, signUpOwner, testAuth, type TestAuth } from "@/test/agent";
import type { Db } from "@/lib/db/client";
import { MCP_RESOURCE } from "@/lib/auth/server";
import { env } from "@/lib/env";
import { createContact, EMPTY_CONTACT, listContacts } from "@/lib/contacts";
import { createDeal, EMPTY_DEAL, getDeal } from "@/lib/deals";
import { agentLog, contact, invoice } from "@/lib/db/schema";
import { makeClient } from "@/lib/clients";
import { createCompany, EMPTY_COMPANY } from "@/lib/companies";
import { mcpEndpoint } from "./endpoint";

let t: { db: Db; close(): Promise<void> };
let auth: TestAuth;
beforeEach(async () => { t = await createTestDb(); auth = testAuth(t.db); });
afterEach(async () => { vi.unstubAllGlobals(); await t.close(); });

const RESOURCE_METADATA = `${env.authUrl}/.well-known/oauth-protected-resource/mcp`;

function post(method: string, params: object, token?: string) {
  return mcpEndpoint({ auth, resource: MCP_RESOURCE, db: () => t.db })(new Request(MCP_RESOURCE, {
    method: "POST",
    headers: {
      "content-type": "application/json", accept: "application/json, text/event-stream",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  }));
}

async function rpc(method: string, params: object, token: string) {
  const res = await post(method, params, token);
  expect(res.status).toBe(200);
  const text = await res.text();
  // a JSON body, or one SSE event carrying it
  const json = text.trimStart().startsWith("{") ? text : /^data: (.*)$/m.exec(text)![1];
  return JSON.parse(json).result;
}

async function readOnlyToken() {
  const cookie = await signUpOwner(auth);
  return (await connectAgent(auth, cookie, "openid profile email offline_access guildhall:read")).access_token;
}

async function changeToken() {
  const cookie = await signUpOwner(auth);
  return (await connectAgent(auth, cookie, ALL_SCOPES)).access_token;
}

describe("the /mcp endpoint without a token", () => {
  it("answers 401 pointing at the protected-resource address", async () => {
    const res = await post("tools/list", {});
    expect(res.status).toBe(401);
    expect(res.headers.get("www-authenticate")).toContain(`resource_metadata="${RESOURCE_METADATA}"`);
  });

  it("asks agents for both scopes, so the owner chooses on /consent", async () => {
    const res = await post("tools/list", {});
    expect(res.headers.get("www-authenticate")).toContain('scope="guildhall:read guildhall:write"');
  });

  it("answers 401 to a made-up token", async () => {
    const res = await post("tools/list", {}, "not-a-real-token");
    expect(res.status).toBe(401);
    expect(res.headers.get("www-authenticate")).toContain(`resource_metadata="${RESOURCE_METADATA}"`);
  });
});

describe("the /mcp endpoint with a signed-in agent", () => {
  it("lists the nine read tools and the four write tools, none destructive, each with a title and description", async () => {
    const { tools } = await rpc("tools/list", {}, await readOnlyToken());
    const writes = ["add_contact", "create_invoice_draft", "log_activity", "move_deal_stage"];
    expect(tools.map((tool: { name: string }) => tool.name).sort()).toEqual([
      "add_contact", "create_invoice_draft", "get_company", "get_contact", "get_deal", "get_invoice", "list_clients",
      "list_pipeline", "list_projects", "list_tasks_due", "log_activity", "move_deal_stage", "search_contacts",
    ]);
    for (const tool of tools) {
      expect(tool.annotations.readOnlyHint, tool.name).toBe(!writes.includes(tool.name));
      expect(tool.annotations.destructiveHint, tool.name).toBe(false);
      expect(tool.title, tool.name).toBeTruthy();
      expect(tool.description).toMatch(/^[A-Z].*\.$/);
    }
  });

  it("answers a tool call with the database's data, recording nothing in the agent log", async () => {
    const token = await changeToken();
    await createContact(t.db, { ...EMPTY_CONTACT, name: "Ada Lovelace", email: "ada@example.com" });
    const result = await rpc("tools/call", { name: "search_contacts", arguments: { query: "ada" } }, token);
    expect(JSON.parse(result.content[0].text)).toMatchObject([{ name: "Ada Lovelace", email: "ada@example.com" }]);
    await rpc("tools/call", { name: "list_pipeline", arguments: {} }, token);
    expect(await t.db.select().from(agentLog)).toEqual([]);
  });

  it("says plainly when an ID matches nothing", async () => {
    const token = await readOnlyToken();
    const result = await rpc("tools/call", { name: "get_deal", arguments: { id: "00000000-0000-4000-8000-000000000000" } }, token);
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toBe("No deal has that ID. Find it with search_contacts or list_pipeline.");
  });

  it("refuses a token without guildhall:read", async () => {
    const cookie = await signUpOwner(auth);
    const { access_token } = await connectAgent(auth, cookie, "openid profile");
    const res = await post("tools/list", {}, access_token);
    expect(res.status).toBe(403);
    expect(res.headers.get("www-authenticate")).toContain('error="insufficient_scope"');
  });
});

describe("the write tools over /mcp", () => {
  it("refuses a Read only agent, changing nothing", async () => {
    const token = await readOnlyToken();
    const result = await rpc("tools/call", { name: "add_contact", arguments: { name: "Ada Lovelace" } }, token);
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toBe("This agent may only read. Reconnect it and allow changes.");
    expect(await t.db.select().from(contact)).toHaveLength(0);
  });

  it("lets a Read and change agent add a contact, log a call and move a deal, each as the owner", async () => {
    const token = await changeToken();
    const added = await rpc("tools/call", { name: "add_contact", arguments: { name: "Ada Lovelace", email: "ada@example.com" } }, token);
    expect(added.isError).toBeFalsy();
    expect(added.content[0].text).toMatch(/^Added 'Ada Lovelace' to contacts\. ID /);
    const [ada] = await listContacts(t.db);
    expect(ada.email).toBe("ada@example.com");

    const dealId = (await createDeal(t.db, { ...EMPTY_DEAL, title: "Acme fit-out", stage: "Proposal", contactId: ada.id })).id!;
    const logged = await rpc("tools/call", { name: "log_activity", arguments: { record_id: dealId, kind: "call", text: "Rang Ada" } }, token);
    expect(logged.content[0].text).toBe("Logged a call on the deal 'Acme fit-out'.");
    const moved = await rpc("tools/call", { name: "move_deal_stage", arguments: { deal_id: dealId, stage: "Won" } }, token);
    expect(moved.content[0].text).toBe("Moved 'Acme fit-out' from Proposal to Won.");
    expect((await getDeal(t.db, dealId))!.stage).toBe("Won");

    // each recorded in the agent log under the name the agent registered with, for the person who connected it
    const log = await t.db.select().from(agentLog);
    expect(log.map((e) => e.tool).sort()).toEqual(["add_contact", "log_activity", "move_deal_stage"]);
    for (const entry of log) expect(entry).toMatchObject({ agentName: "MCP Inspector", userId: expect.any(String) });
  });

  it("drafts an invoice for a client found with list_clients, answering the page's address on this app", async () => {
    const token = await changeToken();
    const companyId = (await createCompany(t.db, { ...EMPTY_COMPANY, name: "Acme" })).id!;
    const dealId = (await createDeal(t.db, { ...EMPTY_DEAL, title: "Acme fit-out", stage: "Won", companyId })).id!;
    await makeClient(t.db, dealId);
    const clients = await rpc("tools/call", { name: "list_clients", arguments: { query: "acme" } }, token);
    const [acme] = JSON.parse(clients.content[0].text);
    const drafted = await rpc("tools/call", {
      name: "create_invoice_draft",
      arguments: { client_id: acme.id, lines: [{ description: "March work, hours", quantity: 10, unit_price: 85 }] },
    }, token);
    expect(drafted.isError).toBeFalsy();
    const [made] = await t.db.select().from(invoice);
    expect(made.status).toBe("Draft");
    expect(drafted.content[0].text).toContain(`${env.authUrl}/invoices/${made.id}`);

    const read = await rpc("tools/call", { name: "get_invoice", arguments: { id_or_number: "INV-0001" } }, token);
    expect(JSON.parse(read.content[0].text)).toMatchObject({ id: made.id, status: "Draft", total: { formatted: "$850.00" } });
    expect(await t.db.select({ tool: agentLog.tool, recordType: agentLog.recordType }).from(agentLog))
      .toEqual([{ tool: "create_invoice_draft", recordType: "invoice" }]);
  });

  it("says plainly when an invoice number matches nothing", async () => {
    const result = await rpc("tools/call", { name: "get_invoice", arguments: { id_or_number: "INV-0099" } }, await readOnlyToken());
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toBe("No invoice has that ID or number. Invoices are numbered like INV-0007.");
  });

  it("refuses a stage that isn't one of the five", async () => {
    const token = await changeToken();
    const dealId = (await createDeal(t.db, { ...EMPTY_DEAL, title: "Acme fit-out" })).id!;
    const result = await rpc("tools/call", { name: "move_deal_stage", arguments: { deal_id: dealId, stage: "Closed" } }, token);
    expect(result.isError).toBe(true);
    expect((await getDeal(t.db, dealId))!.stage).toBe("New");
  });
});
