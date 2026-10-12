import { expect, type APIRequestContext } from "@playwright/test";
import { callTool, startSignIn, test, tokenFor } from "./agent";
import { allowSignUp, OWNER, OWNER_STATE } from "./owner";

// Connected agents (I9): who can reach Guildhall, and cutting one off.
const COLD = { timeout: 60_000 };

function listTools(request: APIRequestContext, token: string) {
  return request.post("/mcp", {
    headers: { accept: "application/json, text/event-stream", authorization: `Bearer ${token}` },
    data: { jsonrpc: "2.0", id: 1, method: "tools/list", params: {} },
    timeout: 60_000,
  });
}

test.describe("as the owner", () => {
  test.use({ storageState: OWNER_STATE });

  test("lists a connected agent, and after Disconnect its next call fails until it is allowed again", async ({ page, agent: request, baseURL }) => {
    // a name of its own: other tests connect agents to the same Guildhall
    const name = `Claude ${Date.now()}`;
    const connect = async () => {
      const { clientId, verifier, back } = await startSignIn(page, request, baseURL!, name);
      await expect(page.getByRole("heading", { name: `${name} wants to use your Guildhall` })).toBeVisible(COLD);
      await page.getByRole("radio", { name: /Read and change/ }).check();
      await page.getByRole("button", { name: "Allow", exact: true }).click();
      return { clientId, token: (await tokenFor(request, baseURL!, clientId, verifier, (await back).searchParams.get("code")!)).access_token };
    };
    const { clientId, token } = await connect();

    await page.goto("/settings");
    await page.getByRole("link", { name: "Connected agents" }).click();
    await expect(page).toHaveURL(/\/settings\/connections$/, COLD);
    await expect(page).toHaveTitle(/^Connected agents · /);
    const row = page.getByRole("list", { name: "Agents" }).getByRole("listitem").filter({ has: page.getByRole("heading", { name }) });
    await expect(row).toContainText(`Connected by${OWNER.name}`);
    await expect(row).toContainText("MayRead and change");
    await expect(row.locator("time")).toHaveCount(1);
    await expect(row).toContainText("Last usedNot used yet");
    await expect(row).not.toContainText(clientId);

    // a call shows as its last use
    expect((await listTools(request, token)).status()).toBe(200);
    await page.reload();
    await expect(row.locator("time")).toHaveCount(2, COLD);

    // Cancel leaves it connected
    await row.getByRole("button", { name: `Disconnect ${name}` }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toContainText(`Disconnect ${name}?`);
    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(dialog).toBeHidden();
    expect((await listTools(request, token)).status()).toBe(200);

    await row.getByRole("button", { name: `Disconnect ${name}` }).click();
    await dialog.getByRole("button", { name: "Disconnect", exact: true }).click();
    await expect(row).toHaveCount(0, COLD);

    const refused = await listTools(request, token);
    expect(refused.status()).toBe(401);
    expect(refused.headers()["www-authenticate"]).toContain("resource_metadata=");

    // allowed again, it works with its new token, and only that one
    const again = await connect();
    expect(await callTool(request, again.token, "list_pipeline", {})).toBeTruthy();
    expect((await listTools(request, token)).status()).toBe(401);
    await page.goto("/settings/connections");
    await expect(row).toHaveCount(1, COLD);
  });

  // Tests run one at a time (playwright.config.ts) and each connects its own agent, so clearing them all is safe here.
  test("with no agents connected, says where to learn to connect Claude", async ({ page }) => {
    await page.goto("/settings/connections");
    await expect(page.getByRole("heading", { name: "Connected agents", level: 1 })).toBeVisible(COLD);
    const disconnect = page.getByRole("list", { name: "Agents" }).getByRole("button", { name: /^Disconnect / });
    while (await disconnect.count() > 0) {
      const before = await disconnect.count();
      await disconnect.first().click();
      await page.getByRole("dialog").getByRole("button", { name: "Disconnect", exact: true }).click();
      await expect(disconnect).toHaveCount(before - 1, COLD);
    }
    await expect(page.getByText("No agents connected. The Intermediate course's chapter 6 shows how to connect Claude.")).toBeVisible();
  });

  test("fits a 375px phone", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 700 });
    await page.goto("/settings/connections");
    await expect(page.getByRole("heading", { name: "Connected agents", level: 1 })).toBeVisible(COLD);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
  });
});

test("a member opening connected agents is sent home", async ({ browser }) => {
  const email = `connections-${Date.now()}@lynn.example`;
  await allowSignUp(browser, email);
  const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  const page = await context.newPage();
  await page.goto("/signup");
  await page.getByLabel("Name").fill("Wat Tyler");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("cloth and wool");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/home$/, COLD);
  await page.goto("/settings/connections");
  await expect(page).toHaveURL(/\/home$/, COLD);
  await context.close();
});
