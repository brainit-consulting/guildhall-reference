// The endpoint end to end over a test database: what an agent sees when it connects, with and without signing in.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createTestDb } from "@/test/db";
import { connectAgent, signUpOwner, testAuth, type TestAuth } from "@/test/agent";
import type { Db } from "@/lib/db/client";
import { MCP_RESOURCE } from "@/lib/auth/server";
import { env } from "@/lib/env";
import { createContact, EMPTY_CONTACT } from "@/lib/contacts";
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
  it("lists the six read tools, each marked read only with a description", async () => {
    const { tools } = await rpc("tools/list", {}, await readOnlyToken());
    expect(tools.map((tool: { name: string }) => tool.name).sort()).toEqual([
      "get_company", "get_contact", "get_deal", "list_pipeline", "list_tasks_due", "search_contacts",
    ]);
    for (const tool of tools) {
      expect(tool.annotations.readOnlyHint).toBe(true);
      expect(tool.description).toMatch(/^[A-Z].*\.$/);
    }
  });

  it("answers a tool call with the database's data", async () => {
    const token = await readOnlyToken();
    await createContact(t.db, { ...EMPTY_CONTACT, name: "Ada Lovelace", email: "ada@example.com" });
    const result = await rpc("tools/call", { name: "search_contacts", arguments: { query: "ada" } }, token);
    expect(JSON.parse(result.content[0].text)).toMatchObject([{ name: "Ada Lovelace", email: "ada@example.com" }]);
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
