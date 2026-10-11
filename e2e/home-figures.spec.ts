import { expect, test, type Page } from "@playwright/test";
import { monthIn, TIME_ZONE } from "../src/lib/dates";
import { OWNER_STATE } from "./owner";

// The dev server compiles each page on its first visit; every wait for a newly opened page uses this.
const COLD = { timeout: 30_000 };

// Tests share one database, so Home is compared with the list it links to inside one test, never with fixed totals.
const figure = (page: Page, name: RegExp) => page.getByRole("region", { name: "Figures" }).getByRole("link", { name });

// Reads the number from a link named like "Proposal: 3 deals".
async function countIn(page: Page, name: RegExp): Promise<number> {
  const link = figure(page, name);
  await expect(link).toBeVisible(COLD);
  return Number((await link.getAttribute("aria-label"))!.match(/: (\d+) /)![1]);
}

async function deleteDeal(page: Page) {
  await expect(async () => {
    await page.getByRole("button", { name: "Delete" }).click();
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 1_000 });
  }).toPass(COLD);
  await page.getByRole("dialog").getByRole("button", { name: "Delete" }).click();
  await expect(page).toHaveURL(/\/deals$/, COLD);
}

test.describe("as the owner", () => {
  test.use({ storageState: OWNER_STATE, viewport: { width: 1280, height: 800 } });

  test("Home's Proposal number is the rows at /deals?stage=Proposal, and every figure links to its list", async ({ page }) => {
    test.slow(); // several pages compile on first visit
    const title = `Lime-wash the barn ${Date.now()}`;
    await page.goto("/deals/new");
    await page.getByLabel("Title").fill(title);
    await page.getByLabel("Value (USD)").fill("320.40");
    await page.getByLabel("Stage").selectOption("Proposal");
    await page.getByRole("button", { name: "Add deal" }).click();
    await expect(page.getByRole("heading", { name: title, level: 1 })).toBeVisible(COLD);
    const dealUrl = page.url();

    await page.goto("/home");
    const proposal = await countIn(page, /^Proposal: \d+ deals?$/);
    expect(proposal).toBeGreaterThanOrEqual(1);

    // every figure points at the list it was counted from
    const month = monthIn(TIME_ZONE, new Date());
    for (const [name, href] of [
      [/^Open deals: /, "/deals?open=1"], [/^Won this month: /, `/deals?won=${month}`], [/^New: /, "/deals?stage=New"],
      [/^Contacted: /, "/deals?stage=Contacted"], [/^Won: /, "/deals?stage=Won"], [/^Lost: /, "/deals?stage=Lost"],
      [/^Overdue: /, "/tasks?due=overdue"], [/^Due today: /, "/tasks?due=today"], [/^Going cold: /, "/deals?cold=1"],
    ] as const) {
      await expect(figure(page, name)).toHaveAttribute("href", href);
    }
    const openName = (await figure(page, /^Open deals: /).getAttribute("aria-label"))!; // "Open deals: 4 deals, worth $1,250.50"

    await figure(page, /^Proposal: /).click();
    await expect(page).toHaveURL(/\/deals\?stage=Proposal$/, COLD);
    const rows = page.getByRole("table").locator("tbody tr");
    await expect(rows.filter({ hasText: title })).toBeVisible(COLD);
    await expect(rows).toHaveCount(proposal);

    // the open figures are the ones /deals?open=1 shows
    await page.goto("/home");
    await figure(page, /^Open deals: /).click();
    await expect(page).toHaveURL(/\/deals\?open=1$/, COLD);
    const shown = page.locator('dl[aria-label="Open deals"] dd');
    await expect(shown.first()).toBeVisible(COLD);
    const [count, money] = [await shown.nth(0).textContent(), await shown.nth(1).textContent()];
    expect(openName).toBe(`Open deals: ${count} ${count === "1" ? "deal" : "deals"}, worth ${money}`);

    await page.goto(dealUrl);
    await deleteDeal(page); // so other tests' totals stay as they were
  });
});

test.describe("at phone width", () => {
  test.use({ storageState: OWNER_STATE, viewport: { width: 390, height: 844 } });

  test("Home's figures wrap and nothing scrolls sideways", async ({ page }) => {
    await page.goto("/home");
    await expect(figure(page, /^Going cold: /)).toBeVisible(COLD);
    const fits = await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);
    expect(fits).toBe(true);
  });
});
