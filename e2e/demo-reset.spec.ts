import { expect, test } from "@playwright/test";
import { OWNER_STATE } from "./owner";

// Runs in its own Playwright project after every other test (playwright.config.ts): a reset wipes what they made. The
// e2e server runs with DEMO_EMAIL set, as the live showcase does.
const COLD = { timeout: 30_000 };

test.use({ storageState: OWNER_STATE });

test("the owner resets the demo data from Settings, after a question", async ({ page }) => {
  test.slow(); // Settings and the list pages may compile on first visit
  const name = `Student Co ${Date.now()}`;
  await page.goto("/companies/new");
  await page.getByLabel("Name").fill(name);
  await page.getByRole("button", { name: "Add company" }).click();
  await expect(page.getByRole("heading", { name, level: 1 })).toBeVisible(COLD);

  await page.goto("/settings");
  const section = page.getByRole("region", { name: "Demo data" });
  const question = page.getByRole("dialog", { name: /^Delete every company, contact, deal, activity, task and enquiry/ });
  await expect(question).toBeHidden();

  // Cancel leaves everything as it was
  await section.getByRole("button", { name: "Reset demo data" }).click();
  await expect(question).toHaveText(
    "Delete every company, contact, deal, activity, task and enquiry, and put the Hollow Oak demo data back? This can't be undone.ResetCancel",
  );
  await expect(question.getByRole("button", { name: "Cancel" })).toBeFocused();
  await question.getByRole("button", { name: "Cancel" }).click();
  await expect(question).toBeHidden();
  await page.goto("/companies");
  await expect(page.getByRole("link", { name, exact: true })).toBeVisible(COLD);

  // Reset puts the Hollow Oak set back
  await page.goto("/settings");
  await section.getByRole("button", { name: "Reset demo data" }).click();
  await question.getByRole("button", { name: "Reset", exact: true }).click();
  await expect(section.getByRole("status")).toHaveText("Demo data is back: 8 companies, 12 contacts, 10 deals.", COLD);
  await expect(question).toBeHidden();

  await page.goto("/companies");
  await expect(page.getByRole("link", { name: "Fairbrook Builders", exact: true })).toBeVisible(COLD);
  await expect(page.getByRole("link", { name, exact: true })).toHaveCount(0);
  await page.goto("/contacts");
  await expect(page.getByRole("heading", { name: "Contacts 12", level: 1 })).toBeVisible(COLD);

  // the owner is still signed in: accounts and sessions are kept
  await page.goto("/settings");
  await expect(page.getByRole("heading", { name: "Settings", level: 1 })).toBeVisible();
});
