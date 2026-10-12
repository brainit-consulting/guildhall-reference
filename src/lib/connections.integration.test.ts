// Connections on a test database, through Better-Auth's real sign-in and the real /mcp endpoint: what the page lists,
// and that Disconnect cuts the agent off at once.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { createTestDb } from "@/test/db";
import {
  ALL_SCOPES, authorize, claims, connectAgent, consent, exchangeCode, registerAgent, signUpOwner, testAuth,
  type TestAuth,
} from "@/test/agent";
import { MCP_RESOURCE } from "@/lib/auth/server";
import type { Db } from "@/lib/db/client";
import { agentLastUse, oauthAccessToken, oauthConsent, oauthRefreshToken, user } from "@/lib/db/schema";
import { env } from "@/lib/env";
import { mcpEndpoint } from "@/lib/mcp/endpoint";
import { disconnectAgent, isStillConnected, listConnections, noteAgentUse } from "./connections";

let t: { db: Db; close(): Promise<void> };
let auth: TestAuth;
beforeEach(async () => { t = await createTestDb(); auth = testAuth(t.db); });
afterEach(async () => { vi.unstubAllGlobals(); await t.close(); });

const READ_ONLY = "openid profile email offline_access guildhall:read";

function listTools(token: string) {
  return mcpEndpoint({ auth, resource: MCP_RESOURCE, db: () => t.db })(new Request(MCP_RESOURCE, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json", accept: "application/json, text/event-stream" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list", params: {} }),
  }));
}

function refresh(clientId: string, refreshToken: string) {
  return auth.handler(new Request(`${env.authUrl}/api/auth/oauth2/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: refreshToken, client_id: clientId, resource: MCP_RESOURCE }),
  }));
}

async function ownerId() {
  return (await t.db.select({ id: user.id }).from(user).where(eq(user.email, "owner@example.com")))[0].id;
}

const clientOf = (token: { access_token: string }) => String(claims(token.access_token).azp);

describe("listConnections", () => {
  it("is empty before any agent is allowed", async () => {
    expect(await listConnections(t.db)).toEqual([]);
  });

  it("lists each agent with who allowed it, what it may do, when, and when it last called /mcp", async () => {
    const cookie = await signUpOwner(auth);
    const before = Date.now() - 1000;
    const token = await connectAgent(auth, cookie, READ_ONLY);
    const [first] = await listConnections(t.db);
    expect(first).toMatchObject({
      clientId: clientOf(token), userId: await ownerId(), agentName: "MCP Inspector", person: "Margery Kempe",
      access: "read", lastUsedAt: null,
    });
    expect(first.connectedAt!.getTime()).toBeGreaterThanOrEqual(before);

    expect((await listTools(token.access_token)).status).toBe(200);
    const [used] = await listConnections(t.db);
    expect(used.lastUsedAt!.getTime()).toBeGreaterThanOrEqual(before);
  });

  it("says Read and change for an agent allowed to change things", async () => {
    await connectAgent(auth, await signUpOwner(auth), ALL_SCOPES);
    expect((await listConnections(t.db)).map((c) => c.access)).toEqual(["change"]);
  });
});

describe("noteAgentUse", () => {
  it("keeps one time per connection, the latest", async () => {
    const token = await connectAgent(auth, await signUpOwner(auth), READ_ONLY);
    await noteAgentUse(t.db, clientOf(token), await ownerId(), new Date("2026-10-01T10:00:00Z"));
    await noteAgentUse(t.db, clientOf(token), await ownerId(), new Date("2026-10-02T10:00:00Z"));
    const rows = await t.db.select().from(agentLastUse);
    expect(rows.map((r) => r.usedAt.toISOString())).toEqual(["2026-10-02T10:00:00.000Z"]);
  });
});

describe("disconnectAgent", () => {
  it("refuses the agent's token at once, with a 401 that sends it back to sign in", async () => {
    const token = await connectAgent(auth, await signUpOwner(auth), ALL_SCOPES);
    expect((await listTools(token.access_token)).status).toBe(200);

    expect(await disconnectAgent(t.db, clientOf(token), await ownerId())).toBe(true);

    const res = await listTools(token.access_token);
    expect(res.status).toBe(401);
    expect(res.headers.get("www-authenticate")).toContain("resource_metadata=");
    expect((await res.json()).error.message).toContain("disconnected");
    expect(await listConnections(t.db)).toEqual([]);
  });

  it("withdraws the consent and every token it holds, so it can't refresh its way back in", async () => {
    const token = await connectAgent(auth, await signUpOwner(auth), ALL_SCOPES);
    expect(token.refresh_token).toBeTruthy();
    await disconnectAgent(t.db, clientOf(token), await ownerId());

    for (const table of [oauthConsent, oauthRefreshToken, oauthAccessToken, agentLastUse]) {
      expect(await t.db.select().from(table)).toEqual([]);
    }
    expect((await refresh(clientOf(token), token.refresh_token!)).status).not.toBe(200);
  });

  it("makes the person allow it again on the consent page, and only the new token works", async () => {
    const cookie = await signUpOwner(auth);
    const clientId = await registerAgent(auth);
    const first = await authorize(auth, clientId, cookie);
    const back = await consent(auth, cookie, first.location, { accept: true, scope: ALL_SCOPES });
    const old = await exchangeCode(auth, clientId, back.searchParams.get("code")!, first.verifier);
    await disconnectAgent(t.db, clientId, await ownerId());

    // a second on, so the new consent is plainly later than the old token
    await new Promise((r) => setTimeout(r, 1100));
    const again = await authorize(auth, clientId, cookie);
    expect(again.location.pathname).toBe("/consent");
    const backAgain = await consent(auth, cookie, again.location, { accept: true, scope: ALL_SCOPES });
    const fresh = await exchangeCode(auth, clientId, backAgain.searchParams.get("code")!, again.verifier);

    expect((await listTools(fresh.access_token)).status).toBe(200);
    expect((await listTools(old.access_token)).status).toBe(401);
  });

  it("leaves the person's other agents connected", async () => {
    const cookie = await signUpOwner(auth);
    const a = await connectAgent(auth, cookie, READ_ONLY);
    const b = await connectAgent(auth, cookie, READ_ONLY);
    await disconnectAgent(t.db, clientOf(a), await ownerId());
    expect((await listTools(b.access_token)).status).toBe(200);
    expect(await listConnections(t.db)).toHaveLength(1);
  });

  it("is false when there was nothing to disconnect", async () => {
    await signUpOwner(auth);
    expect(await disconnectAgent(t.db, "no-such-agent", await ownerId())).toBe(false);
  });
});

describe("isStillConnected", () => {
  it("is false for an agent the person never allowed", async () => {
    await signUpOwner(auth);
    expect(await isStillConnected(t.db, "no-such-agent", await ownerId(), Math.floor(Date.now() / 1000))).toBe(false);
  });
});
