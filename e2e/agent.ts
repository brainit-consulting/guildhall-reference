import { createHash, randomBytes } from "node:crypto";
import { expect, test as base, type APIRequestContext, type Page } from "@playwright/test";

// An agent connecting to Guildhall (I5), the way the MCP Inspector does: it registers, sends the owner's browser to
// sign in and to /consent, and swaps the code it gets back for a token. The agent's own callback address isn't
// running, so the test catches the browser there.

// The agent's own requests: no browser cookies, as a real agent has none (signed-in tests' `request` carries the
// owner's, and Better-Auth then asks for an Origin header as it would of a web page).
export const test = base.extend<{ agent: APIRequestContext }>({
  agent: async ({ playwright, baseURL }, provide) => {
    const agent = await playwright.request.newContext({ baseURL, storageState: { cookies: [], origins: [] } });
    await provide(agent);
    await agent.dispose();
  },
});

export const CALLBACK = "http://127.0.0.1:9/oauth/callback";
export const SCOPES = "openid profile email offline_access guildhall:read guildhall:write";

export async function register(request: APIRequestContext, name = "Test Agent") {
  const res = await request.post("/api/auth/oauth2/register", {
    data: {
      client_name: name, redirect_uris: [CALLBACK], token_endpoint_auth_method: "none",
      grant_types: ["authorization_code", "refresh_token"], response_types: ["code"], application_type: "native",
    },
    timeout: 60_000,
  });
  expect(res.ok(), await res.text()).toBe(true);
  return (await res.json()).client_id as string;
}

export async function startSignIn(page: Page, request: APIRequestContext, baseURL: string, name?: string) {
  const clientId = await register(request, name);
  const verifier = randomBytes(32).toString("base64url");
  const query = new URLSearchParams({
    response_type: "code", client_id: clientId, redirect_uri: CALLBACK, scope: SCOPES, state: "e2e",
    code_challenge: createHash("sha256").update(verifier).digest("base64url"), code_challenge_method: "S256",
    resource: `${baseURL}/mcp`,
  });
  // the agent's callback: note where the browser was sent back to, instead of loading it
  const back = new Promise<URL>((resolve) => page.route(`${CALLBACK}**`, async (route) => {
    resolve(new URL(route.request().url()));
    await route.fulfill({ body: "back with the agent" });
  }));
  await page.goto(`/api/auth/oauth2/authorize?${query}`);
  return { clientId, verifier, back };
}

export async function tokenFor(request: APIRequestContext, baseURL: string, clientId: string, verifier: string, code: string) {
  const res = await request.post("/api/auth/oauth2/token", {
    form: {
      grant_type: "authorization_code", code, redirect_uri: CALLBACK, client_id: clientId, code_verifier: verifier,
      resource: `${baseURL}/mcp`,
    },
  });
  expect(res.ok(), await res.text()).toBe(true);
  return (await res.json()) as { access_token: string; scope: string };
}

// One tool call on /mcp as the agent; the answer's text line.
export async function callTool(request: APIRequestContext, token: string, name: string, args: object) {
  const res = await request.post("/mcp", {
    headers: { accept: "application/json, text/event-stream", authorization: `Bearer ${token}` },
    data: { jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args } },
    timeout: 60_000,
  });
  expect(res.status()).toBe(200);
  const body = await res.text();
  // a JSON body, or one SSE event carrying it
  const json = body.trimStart().startsWith("{") ? body : /^data: (.*)$/m.exec(body)![1];
  return JSON.parse(json).result.content[0].text as string;
}
