import { createHash, randomBytes } from "node:crypto";
import { expect, test as base, type APIRequestContext, type Page } from "@playwright/test";
import { OWNER, OWNER_STATE } from "./owner";

// An agent connecting to Guildhall (I5), the way the MCP Inspector does: it registers, sends the owner's browser to
// sign in and to /consent, and swaps the code it gets back for a token. The agent's own callback address isn't
// running, so the test catches the browser there.
const COLD = { timeout: 60_000 };

// The agent's own requests: no browser cookies, as a real agent has none (signed-in tests' `request` carries the
// owner's, and Better-Auth then asks for an Origin header as it would of a web page).
const test = base.extend<{ agent: APIRequestContext }>({
  agent: async ({ playwright, baseURL }, provide) => {
    const agent = await playwright.request.newContext({ baseURL, storageState: { cookies: [], origins: [] } });
    await provide(agent);
    await agent.dispose();
  },
});
const CALLBACK = "http://127.0.0.1:9/oauth/callback";
const SCOPES = "openid profile email offline_access guildhall:read guildhall:write";

async function register(request: APIRequestContext) {
  const res = await request.post("/api/auth/oauth2/register", {
    data: {
      client_name: "Test Agent", redirect_uris: [CALLBACK], token_endpoint_auth_method: "none",
      grant_types: ["authorization_code", "refresh_token"], response_types: ["code"], application_type: "native",
    },
    timeout: 60_000,
  });
  expect(res.ok(), await res.text()).toBe(true);
  return (await res.json()).client_id as string;
}

async function startSignIn(page: Page, request: APIRequestContext, baseURL: string) {
  const clientId = await register(request);
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

async function tokenFor(request: APIRequestContext, baseURL: string, clientId: string, verifier: string, code: string) {
  const res = await request.post("/api/auth/oauth2/token", {
    form: {
      grant_type: "authorization_code", code, redirect_uri: CALLBACK, client_id: clientId, code_verifier: verifier,
      resource: `${baseURL}/mcp`,
    },
  });
  expect(res.ok(), await res.text()).toBe(true);
  return (await res.json()) as { access_token: string; scope: string };
}

test.describe("signed out", () => {
  test("signs in first, then Read only grants reading and no changes", async ({ page, agent: request, baseURL }) => {
    const { clientId, verifier, back } = await startSignIn(page, request, baseURL!);
    await expect(page).toHaveURL(/\/signin\?/, COLD);
    await page.getByLabel("Email").fill(OWNER.email);
    await page.getByLabel("Password").fill(OWNER.password);
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page.getByRole("heading", { name: "Test Agent wants to use your Guildhall" })).toBeVisible(COLD);
    await expect(page).toHaveTitle(/^Connect an agent · /);
    await expect(page.getByRole("radio", { name: /Read only/ })).toBeChecked();
    await page.getByRole("button", { name: "Allow", exact: true }).click();

    const code = (await back).searchParams.get("code");
    expect(code).toBeTruthy();
    const token = await tokenFor(request, baseURL!, clientId, verifier, code!);
    expect(token.scope.split(" ")).toContain("guildhall:read");
    expect(token.scope.split(" ")).not.toContain("guildhall:write");

    // the token opens /mcp
    const res = await request.post("/mcp", {
      headers: { accept: "application/json, text/event-stream", authorization: `Bearer ${token.access_token}` },
      data: { jsonrpc: "2.0", id: 1, method: "tools/list", params: {} },
    });
    expect(res.status()).toBe(200);
    expect(await res.text()).toContain("list_pipeline");
  });
});

test.describe("signed in", () => {
  test.use({ storageState: OWNER_STATE });

  test("Read and change grants changes", async ({ page, agent: request, baseURL }) => {
    const { clientId, verifier, back } = await startSignIn(page, request, baseURL!);
    await expect(page.getByRole("heading", { name: "Test Agent wants to use your Guildhall" })).toBeVisible(COLD);
    await page.getByRole("radio", { name: /Read and change/ }).check();
    await page.getByRole("button", { name: "Allow", exact: true }).click();

    const token = await tokenFor(request, baseURL!, clientId, verifier, (await back).searchParams.get("code")!);
    expect(token.scope.split(" ")).toEqual(expect.arrayContaining(["guildhall:read", "guildhall:write"]));
  });

  test("Don't allow sends the agent away with no code", async ({ page, agent: request, baseURL }) => {
    const { back } = await startSignIn(page, request, baseURL!);
    await expect(page.getByRole("heading", { name: "Test Agent wants to use your Guildhall" })).toBeVisible(COLD);
    await page.getByRole("button", { name: "Don't allow" }).click();
    const url = await back;
    expect(url.searchParams.get("error")).toBe("access_denied");
    expect(url.searchParams.has("code")).toBe(false);
  });

  test("an address without the agent's request says to start again", async ({ page }) => {
    await page.goto("/consent?client_id=nobody");
    await expect(page.getByRole("alert")).toHaveText("This link doesn't work any more. Go back to the agent and connect it again.", COLD);
  });

  test("fits a 375px phone", async ({ page, agent: request, baseURL }) => {
    await page.setViewportSize({ width: 375, height: 700 });
    await startSignIn(page, request, baseURL!);
    await expect(page.getByRole("heading", { name: "Test Agent wants to use your Guildhall" })).toBeVisible(COLD);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
  });
});
