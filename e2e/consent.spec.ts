import { expect } from "@playwright/test";
import { callTool, startSignIn, test, tokenFor } from "./agent";
import { OWNER, OWNER_STATE } from "./owner";

// An agent connecting to Guildhall (I5): signing in, the two kinds of access, and saying no.
const COLD = { timeout: 60_000 };

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
    expect(await callTool(request, token.access_token, "add_contact", { name: "Read Only Agent Contact" }))
      .toBe("This agent may only read. Reconnect it and allow changes.");

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

  test("Read and change grants changes, which show in Guildhall", async ({ page, agent: request, baseURL }) => {
    const { clientId, verifier, back } = await startSignIn(page, request, baseURL!);
    await expect(page.getByRole("heading", { name: "Test Agent wants to use your Guildhall" })).toBeVisible(COLD);
    await page.getByRole("radio", { name: /Read and change/ }).check();
    await page.getByRole("button", { name: "Allow", exact: true }).click();

    const token = await tokenFor(request, baseURL!, clientId, verifier, (await back).searchParams.get("code")!);
    expect(token.scope.split(" ")).toEqual(expect.arrayContaining(["guildhall:read", "guildhall:write"]));

    const name = `Agent Added ${Date.now()}`;
    const added = await callTool(request, token.access_token, "add_contact", { name, job_title: "Cabinet maker" });
    const id = /ID (\S+)\.$/.exec(added)![1];
    expect(await callTool(request, token.access_token, "log_activity", { record_id: id, kind: "call", text: "Rang about the dresser" }))
      .toBe(`Logged a call on the contact '${name}'.`);
    await page.goto(`/contacts/${id}`);
    await expect(page.getByRole("heading", { name })).toBeVisible(COLD);
    await expect(page.getByText("Rang about the dresser")).toBeVisible();
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
