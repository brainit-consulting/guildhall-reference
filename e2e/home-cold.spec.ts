import { expect, test, type Page } from "@playwright/test";
import { OWNER_STATE } from "./owner";

// The dev server compiles each page on its first visit; every wait for a newly opened page uses this.
const COLD = { timeout: 30_000 };

// A deal can't be backdated through the UI, so the 15-day case, the order and the cap of 10 live in
// src/lib/cold.integration.test.ts. This covers what the UI can reach: the section is on Home, and a deal added now
// isn't in it.
const goingCold = (page: Page) => page.getByRole("region", { name: "Going cold" });

async function addDeal(page: Page, title: string) {
  await page.goto("/deals/new");
  await expect(page.getByRole("heading", { name: "Add deal", level: 1 })).toBeVisible(COLD);
  await page.getByLabel("Title").fill(title);
  await page.getByRole("button", { name: "Add deal" }).click();
  await expect(page.getByRole("heading", { name: title, level: 1 })).toBeVisible(COLD);
}

async function deleteDeal(page: Page) {
  await expect(async () => {
    await page.getByRole("button", { name: "Delete" }).click();
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 1_000 });
  }).toPass(COLD);
  await page.getByRole("dialog").getByRole("button", { name: "Delete" }).click();
  await expect(page).toHaveURL(/\/deals$/, COLD);
}

// Other specs may leave deals, but none that are 14 days old, so the section is either empty or lists older ones.
async function seeSection(page: Page, title: string) {
  await page.goto("/home");
  const section = goingCold(page);
  await expect(section.getByRole("heading", { name: "Going cold", level: 2 })).toBeVisible(COLD);
  await expect(section).toContainText(/No deals going cold\.|Nothing for \d+ days/);
  await expect(section).not.toContainText(title);
}

for (const [label, viewport] of [["at desktop width", { width: 1280, height: 800 }], ["at phone width", { width: 390, height: 844 }]] as const) {
  test.describe(label, () => {
    test.use({ storageState: OWNER_STATE, viewport });

    test("Home has a Going cold section, and a deal added now isn't in it", async ({ page }) => {
      const title = `Fresh slates hc${Date.now()}`;
      await addDeal(page, title);
      const dealUrl = page.url();

      await seeSection(page, title);
      // Going cold comes after the welcome and any tasks due
      const headings = await page.getByRole("heading", { level: 2 }).allTextContents();
      expect(headings.at(-1)).toBe("Going cold");
      const fits = await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);
      expect(fits).toBe(true);

      await page.goto(dealUrl);
      await deleteDeal(page); // so other tests' open totals stay as they were
    });
  });
}
