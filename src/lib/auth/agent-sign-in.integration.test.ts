// An agent signing in through Better-Auth's real endpoints on a test database: what the owner's choice on /consent
// puts in the token, and what the discovery addresses answer.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { createTestDb } from "@/test/db";
import {
  ALL_SCOPES, authorize, claims, connectAgent, consent, registerAgent, signUpOwner, testAuth, type TestAuth,
} from "@/test/agent";
import { grantedScopes } from "@/lib/agent-access";
import type { Db } from "@/lib/db/client";
import { user } from "@/lib/db/schema";
import { env } from "@/lib/env";
import { mcpEndpoint } from "@/lib/mcp/endpoint";
import { discovery } from "./discovery";
import { MCP_RESOURCE } from "./server";

let t: { db: Db; close(): Promise<void> };
let auth: TestAuth;
beforeEach(async () => { t = await createTestDb(); auth = testAuth(t.db); });
afterEach(async () => { vi.unstubAllGlobals(); await t.close(); });

describe("the consent page's choice", () => {
  it("Read only never grants guildhall:write, even when the agent asked for it", async () => {
    const cookie = await signUpOwner(auth);
    const token = await connectAgent(auth, cookie, grantedScopes(ALL_SCOPES, "read"));
    expect(token.scope.split(" ")).toContain("guildhall:read");
    expect(token.scope.split(" ")).not.toContain("guildhall:write");
    expect(String(claims(token.access_token).scope).split(" ")).not.toContain("guildhall:write");
  });

  it("Read and change grants guildhall:write", async () => {
    const cookie = await signUpOwner(auth);
    const token = await connectAgent(auth, cookie, grantedScopes(ALL_SCOPES, "change"));
    expect(String(claims(token.access_token).scope).split(" ")).toEqual(expect.arrayContaining(["guildhall:read", "guildhall:write"]));
  });

  it("issues the token for /mcp, as the person who allowed it", async () => {
    const cookie = await signUpOwner(auth);
    const token = await connectAgent(auth, cookie, grantedScopes(ALL_SCOPES, "read"));
    const [owner] = await t.db.select().from(user).where(eq(user.email, "owner@example.com"));
    const issued = claims(token.access_token);
    expect(issued.aud).toContain(MCP_RESOURCE);
    expect(issued.sub).toBe(owner.id);
  });

  it("Don't allow sends the agent away with no code", async () => {
    const cookie = await signUpOwner(auth);
    const { location } = await authorize(auth, await registerAgent(auth), cookie);
    const back = await consent(auth, cookie, location, { accept: false });
    expect(back.searchParams.get("error")).toBe("access_denied");
    expect(back.searchParams.has("code")).toBe(false);
  });

  it("sends someone not signed in to sign in first, then to the consent page", async () => {
    const { location } = await authorize(auth, await registerAgent(auth));
    expect(location.pathname).toBe("/signin");
    const cookie = await signUpOwner(auth);
    const { location: next } = await authorize(auth, await registerAgent(auth), cookie);
    expect(next.pathname).toBe("/consent");
    expect(next.searchParams.get("client_id")).toBeTruthy();
  });

  it("signs the agent out when the person it signed in as is gone", async () => {
    const cookie = await signUpOwner(auth);
    const { access_token } = await connectAgent(auth, cookie, grantedScopes(ALL_SCOPES, "read"));
    await t.db.delete(user);
    const res = await mcpEndpoint({ auth, resource: MCP_RESOURCE, db: () => t.db })(new Request(MCP_RESOURCE, {
      method: "POST",
      headers: { authorization: `Bearer ${access_token}`, "content-type": "application/json", accept: "application/json, text/event-stream" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list", params: {} }),
    }));
    expect(res.status).toBe(401);
    expect(res.headers.get("www-authenticate")).toContain("resource_metadata=");
  });
});

describe("the discovery addresses", () => {
  const get = (path: string) => discovery(auth)(new Request(`${env.authUrl}${path}`));
  const issuer = `${env.authUrl}/api/auth`;

  it.each(["/.well-known/oauth-protected-resource", "/.well-known/oauth-protected-resource/mcp"])(
    "%s names /mcp, its sign-in and its two scopes", async (path) => {
      const res = await get(path);
      expect(res.status).toBe(200);
      expect(await res.json()).toMatchObject({
        resource: MCP_RESOURCE, authorization_servers: [issuer], scopes_supported: ["guildhall:read", "guildhall:write"],
      });
    });

  it.each([
    "/.well-known/oauth-authorization-server", "/.well-known/oauth-authorization-server/api/auth",
    "/.well-known/openid-configuration",
  ])("%s says how to sign in, with registration and PKCE", async (path) => {
    const res = await get(path);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("application/json");
    const body = await res.json();
    expect(body).toMatchObject({
      issuer,
      authorization_endpoint: `${issuer}/oauth2/authorize`,
      token_endpoint: `${issuer}/oauth2/token`,
      registration_endpoint: `${issuer}/oauth2/register`,
      code_challenge_methods_supported: ["S256"],
    });
    expect(body.scopes_supported).toEqual(expect.arrayContaining(["guildhall:read", "guildhall:write", "offline_access"]));
  });

  it("/api/auth/.well-known/openid-configuration answers from Better-Auth's own route", async () => {
    const res = await auth.handler(new Request(`${issuer}/.well-known/openid-configuration`));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ issuer });
  });
});
