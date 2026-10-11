import { expect, test, type Page } from "@playwright/test";
import { OWNER_STATE } from "./owner";

// The dev server compiles each page on its first visit; every wait for a newly opened page uses this.
const COLD = { timeout: 30_000 };

// A deal can't be backdated through the UI, so the 14-day cases live in src/lib/cold*.test.ts. This covers what the
// UI can reach: a deal added now is not going cold, and the switch keeps `cold=1` in the address.
const goingCold = (page: Page) => page.getByRole("switch", { name: "Going cold" });

async function addDeal(page: Page, title: string) {
  await page.goto("/deals/new");
  await expect(page.getByRole("heading", { name: "Add deal", level: 1 })).toBeVisible(COLD);
  await page.getByLabel("Title").fill(title);
  await page.getByRole("button", { name: "Add deal" }).click();
  await expect(page.getByRole("heading", { name: title, level: 1 })).toBeVisible(COLD);
}

test.describe("as the owner", () => {
  test.use({ storageState: OWNER_STATE, viewport: { width: 1280, height: 800 } });

  test("a deal added now is not going cold, and the Going cold switch is kept in the address", async ({ page }) => {
    const title = `Fresh gutters gc${Date.now()}`;
    await addDeal(page, title);

    await page.goto("/deals");
    const row = page.getByRole("row").filter({ hasText: title });
    await expect(row).toBeVisible(COLD);
    await expect(row).not.toContainText("Going cold");
    await expect(goingCold(page)).toHaveAttribute("aria-checked", "false");

    await goingCold(page).click();
    await expect(page).toHaveURL(/\/deals\?cold=1$/);
    await expect(goingCold(page)).toHaveAttribute("aria-checked", "true");
    await expect(page.getByText(title)).toHaveCount(0);

    await page.reload();
    await expect(goingCold(page)).toHaveAttribute("aria-checked", "true", COLD);
    await expect(page).toHaveURL(/\/deals\?cold=1$/);
    await expect(page.getByText(title)).toHaveCount(0);

    // and off again, from the keyboard
    await goingCold(page).focus();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/deals$/);
    await expect(page.getByRole("row").filter({ hasText: title })).toBeVisible();
  });

  test("junk in the address is ignored", async ({ page }) => {
    await page.goto("/deals?cold=yes");
    await expect(goingCold(page)).toHaveAttribute("aria-checked", "false", COLD);
  });
});

test.describe("at phone width", () => {
  test.use({ storageState: OWNER_STATE, viewport: { width: 390, height: 844 } });

  test("Going cold flips with Space and the page still fits", async ({ page }) => {
    const title = `Fresh porch gc${Date.now()}`;
    await addDeal(page, title);
    await page.goto("/deals");
    const block = page.getByRole("list", { name: "Deals" }).getByRole("listitem").filter({ hasText: title });
    await expect(block).toBeVisible(COLD);
    await expect(block).not.toContainText("Going cold");

    await goingCold(page).focus();
    await page.keyboard.press("Space");
    await expect(page).toHaveURL(/\/deals\?cold=1$/);
    await expect(page.getByText(title)).toHaveCount(0);

    const fits = await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);
    expect(fits).toBe(true);
  });
});
