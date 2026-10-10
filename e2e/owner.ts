import { expect, type Browser } from "@playwright/test";

// The owner signed up by owner.setup.ts, before every other test. Kept with the e2e database in .data/ (git-ignored).
export const OWNER = { name: "Margery Kempe", email: "owner@guildhall.example", password: "lynn ledger 1373" };
export const OWNER_STATE = ".data/e2e-owner.json";

// Adds emails to the owner's "People who may sign up" list, the way the owner would, so a test can sign them up.
export async function allowSignUp(browser: Browser, ...emails: string[]) {
  const context = await browser.newContext({ storageState: OWNER_STATE });
  const page = await context.newPage();
  await page.goto("/settings");
  for (const email of emails) {
    await page.getByLabel("Email").fill(email);
    await page.getByRole("button", { name: "Add email" }).click();
    await expect(page.getByRole("cell", { name: email, exact: true })).toBeVisible();
  }
  await context.close();
}
