import { expect } from "@playwright/test";
import { callTool, startSignIn, test, tokenFor } from "./agent";
import { allowSignUp, OWNER, OWNER_STATE } from "./owner";

// The agent log (I8): what an agent changed, for whom and when, on a page only the owner opens.
const COLD = { timeout: 60_000 };

test.describe("as the owner", () => {
  test.use({ storageState: OWNER_STATE });

  test("after Claude moves a deal, the log says so, with the time and a link to the deal", async ({ page, agent: request, baseURL }) => {
    const title = `Acme fit-out ${Date.now()}`;
    await page.goto("/deals/new");
    await page.getByLabel("Title").fill(title);
    await page.getByLabel("Stage").selectOption("Proposal");
    await page.getByRole("button", { name: "Add deal" }).click();
    await expect(page.getByRole("heading", { name: title, level: 1 })).toBeVisible(COLD);
    const dealUrl = new URL(page.url()).pathname;
    const dealId = dealUrl.split("/").pop()!;

    const { clientId, verifier, back } = await startSignIn(page, request, baseURL!, "Claude");
    await expect(page.getByRole("heading", { name: "Claude wants to use your Guildhall" })).toBeVisible(COLD);
    await page.getByRole("radio", { name: /Read and change/ }).check();
    await page.getByRole("button", { name: "Allow", exact: true }).click();
    const token = (await tokenFor(request, baseURL!, clientId, verifier, (await back).searchParams.get("code")!)).access_token;

    // a look records nothing; the move does
    await callTool(request, token, "get_deal", { id: dealId });
    expect(await callTool(request, token, "move_deal_stage", { deal_id: dealId, stage: "Won" }))
      .toBe(`Moved '${title}' from Proposal to Won.`);

    await page.goto("/settings");
    await page.getByRole("link", { name: "Open the agent log" }).click();
    await expect(page).toHaveURL(/\/settings\/agent-log$/, COLD);
    await expect(page).toHaveTitle(/^Agent log · /);
    const entry = page.getByRole("list", { name: "Changes" }).getByRole("listitem").first();
    await expect(entry).toContainText(`Claude, for ${OWNER.name}: Moved '${title}' from Proposal to Won.`);
    await expect(entry).toContainText("Tool: move_deal_stage");
    // the time, in the reader's own time zone once the page has loaded
    await expect(entry.locator("time")).toHaveText(/^\d{1,2} [A-Z][a-z]{2} \d{4}, \d{2}:\d{2}$/);
    await expect(entry).not.toContainText(dealId);
    await expect(page.getByText(`get_deal`)).toBeHidden();

    // filtered to this Claude, it's still there; to another agent, it isn't
    await page.getByLabel("Agent").selectOption(clientId);
    await expect(page).toHaveURL(new RegExp(`agent=${clientId}$`), COLD);
    await expect(page.getByRole("list", { name: "Changes" }).getByRole("listitem")).toHaveCount(1);
    await page.getByLabel("Agent").selectOption("");
    await expect(page).toHaveURL(/\/settings\/agent-log$/, COLD);

    await page.getByRole("list", { name: "Changes" }).getByRole("listitem").first().getByRole("link", { name: `Deal: ${title}` }).click();
    await expect(page).toHaveURL(new RegExp(`${dealUrl}$`), COLD);
    await expect(page.getByRole("heading", { name: title, level: 1 })).toBeVisible();
  });

  test("a page number that's junk or far too big shows the newest changes", async ({ page }) => {
    for (const asked of ["1e20", "99999999999999999999", "200000000000000000", "abc", "-3"]) {
      const res = await page.goto(`/settings/agent-log?page=${asked}`);
      expect(res?.status(), asked).toBe(200);
      await expect(page.getByRole("heading", { name: "Agent log", level: 1 })).toBeVisible(COLD);
      await expect(page.getByText("Nothing on this page.")).toBeHidden();
    }
  });

  test("fits a 375px phone", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 700 });
    await page.goto("/settings/agent-log");
    await expect(page.getByRole("heading", { name: "Agent log", level: 1 })).toBeVisible(COLD);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
  });
});

test("a member opening the agent log is sent home", async ({ browser }) => {
  const email = `log-${Date.now()}@lynn.example`;
  await allowSignUp(browser, email);
  const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  const page = await context.newPage();
  await page.goto("/signup");
  await page.getByLabel("Name").fill("Wat Tyler");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("cloth and wool");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/home$/, COLD);
  await page.goto("/settings/agent-log");
  await expect(page).toHaveURL(/\/home$/, COLD);
  await context.close();
});
