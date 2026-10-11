import { expect, test, type Page } from "@playwright/test";
import { formatDay, formatMonth, monthIn, TIME_ZONE, todayIn } from "../src/lib/dates";
import { OWNER_STATE } from "./owner";

// The dev server compiles each page on its first visit; every wait for a newly opened page uses this.
const COLD = { timeout: 30_000 };

// The business's month and day, as the app works them out, so this passes on the UTC runner and late at night locally.
const now = new Date();
const month = monthIn(TIME_ZONE, now);
const today = todayIn(TIME_ZONE, now);

const card = (page: Page, stage: string, title: string) => page.getByRole("region", { name: stage, exact: true })
  .getByRole("listitem").filter({ has: page.getByRole("link", { name: title, exact: true }) });

// Tests share one database, so the figures are read before and after rather than expected outright. Amounts are
// compared in cents, as whole numbers, never as floats.
async function figures(page: Page, name: string): Promise<{ count: number; cents: bigint }> {
  const row = page.locator(`dl[aria-label="${name}"] dd`);
  await expect(row.first()).toBeVisible(COLD);
  const money = (await row.nth(1).textContent())!; // "$1,250.50"
  expect(money).toMatch(/^\$[\d,]+\.\d{2}$/);
  return { count: Number(await row.nth(0).textContent()), cents: BigInt(money.replace(/[^\d]/g, "")) };
}

test.describe("as the owner", () => {
  test.use({ storageState: OWNER_STATE });

  test("a deal moved to Won is listed among the deals won this month, with their figures", async ({ page }) => {
    test.slow(); // several pages compile on first visit
    const title = `Gild the weathervane ${Date.now()}`;

    await page.goto(`/deals?won=${month}`);
    await expect(page.getByText(`Won in ${formatMonth(month)}.`)).toBeVisible(COLD);
    const before = await figures(page, "Won deals");

    await page.goto("/deals/new");
    await page.getByLabel("Title").fill(title);
    await page.getByLabel("Value (USD)").fill("250.75");
    await page.getByRole("button", { name: "Add deal" }).click();
    await expect(page.getByRole("heading", { name: title, level: 1 })).toBeVisible(COLD);

    // moved on the board; the menu works once the board has hydrated, so a click before then is tried again
    await page.goto("/pipeline");
    const fresh = card(page, "New", title);
    await expect(async () => {
      await fresh.getByRole("button", { name: "Move to…" }).click();
      await expect(page.getByRole("menu")).toBeVisible({ timeout: 1_000 });
    }).toPass(COLD);
    await page.getByRole("menuitem", { name: "Move to Won" }).click();
    await expect(card(page, "Won", title)).toBeVisible(COLD);

    // listed this month, every row at Won, and the figures moved by exactly this deal
    await page.goto(`/deals?won=${month}`);
    await expect(page.getByRole("link", { name: title, exact: true })).toBeVisible(COLD);
    expect(await figures(page, "Won deals")).toEqual({ count: before.count + 1, cents: before.cents + 25_075n });
    await expect(page.getByRole("table").locator("tbody tr td:nth-child(4)")).toHaveText(Array(before.count + 1).fill("Won"));

    // the deal says the day it was won
    await page.getByRole("link", { name: title, exact: true }).click();
    await expect(page.getByRole("heading", { name: title, level: 1 })).toBeVisible(COLD);
    await expect(page.getByText(`Won ${formatDay(today)}`, { exact: true })).toBeVisible();

    // taking the month off keeps the sort, and the open figures come back
    await page.goto(`/deals?won=${month}&sort=value&dir=desc`);
    await page.getByRole("link", { name: "Show every month" }).click();
    await expect(page).toHaveURL(/\/deals\?sort=value&dir=desc$/, COLD);
    await expect(page.getByText(`Won in ${formatMonth(month)}.`)).toHaveCount(0);
    await expect(page.locator('dl[aria-label="Open deals"]')).toBeVisible();

    // delete it, so the shared database is as it was
    await page.getByRole("link", { name: title, exact: true }).click();
    await expect(page.getByRole("heading", { name: title, level: 1 })).toBeVisible(COLD);
    await expect(async () => {
      await page.getByRole("button", { name: "Delete" }).click();
      await expect(page.getByRole("dialog")).toBeVisible({ timeout: 1_000 });
    }).toPass(COLD);
    await page.getByRole("dialog").getByRole("button", { name: "Delete" }).click();
    await expect(page).toHaveURL(/\/deals$/, COLD);
    await page.goto(`/deals?won=${month}`);
    expect(await figures(page, "Won deals")).toEqual(before);
  });

  test("a month with no deals won says so, and Clear filters takes the month off too", async ({ page }) => {
    await page.goto("/deals?won=1999-01&sort=title");
    await expect(page.getByText("Won in January 1999.")).toBeVisible(COLD);
    expect(await figures(page, "Won deals")).toEqual({ count: 0, cents: 0n });
    await page.getByRole("link", { name: "Clear filters" }).click();
    await expect(page).toHaveURL(/\/deals\?sort=title$/, COLD);
  });

  test("won that isn't a real month shows the normal list", async ({ page }) => {
    for (const won of ["junk", "2026-13"]) {
      await page.goto(`/deals?won=${won}`);
      await expect(page.locator('dl[aria-label="Open deals"]')).toBeVisible(COLD);
      await expect(page.getByText(/^Won in /)).toHaveCount(0);
    }
  });
});
