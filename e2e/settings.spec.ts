import { expect, test, type Page } from "@playwright/test";
import { OWNER_STATE } from "./owner";

async function signUp(page: Page, name: string, email: string) {
  await page.goto("/signup");
  await page.getByLabel("Name").fill(name);
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("cloth and wool");
  await page.getByRole("button", { name: "Create account" }).click();
}

test.describe("as the owner", () => {
  test.use({ storageState: OWNER_STATE });

  test("adding an email in Settings lets that person sign up", async ({ page, browser }) => {
    const email = `wat-${Date.now()}@lynn.example`;
    await page.goto("/settings");
    await page.getByLabel("Email").fill(email.toUpperCase());
    await page.getByRole("button", { name: "Add email" }).click();
    await expect(page.getByRole("cell", { name: email, exact: true })).toBeVisible();
    await expect(page.getByLabel("Email")).toHaveValue("");

    // adding it twice is explained, and what was typed stays to be fixed
    await page.getByLabel("Email").fill(email);
    await page.getByRole("button", { name: "Add email" }).click();
    await expect(page.locator("form").getByRole("alert")).toHaveText("That email is already on the list.");
    await expect(page.getByLabel("Email")).toHaveValue(email);

    const visitor = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const theirs = await visitor.newPage();
    await signUp(theirs, "Wat Tyler", email);
    await expect(theirs).toHaveURL(/\/home$/);
    await expect(theirs.getByRole("heading", { name: "Welcome, Wat Tyler." })).toBeVisible();

    // a member opening Settings is sent home
    await theirs.goto("/settings");
    await expect(theirs).toHaveURL(/\/home$/);
    await visitor.close();
  });

  test("removing an email closes sign-up to it again", async ({ page, browser }) => {
    const email = `alice-${Date.now()}@lynn.example`;
    await page.goto("/settings");
    await page.getByLabel("Email").fill(email);
    await page.getByRole("button", { name: "Add email" }).click();
    await page.getByRole("button", { name: `Remove ${email}` }).click();
    await expect(page.getByRole("cell", { name: email, exact: true })).toHaveCount(0);

    const visitor = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const theirs = await visitor.newPage();
    await signUp(theirs, "Alice", email);
    await expect(theirs.locator("form").getByRole("alert")).toHaveText("Ask the owner to add your email in Settings.");
    await visitor.close();
  });

  test("a malformed email is explained", async ({ page }) => {
    await page.goto("/settings");
    await page.getByLabel("Email").fill("wat-at-lynn");
    await page.getByRole("button", { name: "Add email" }).click();
    await expect(page.locator("form").getByRole("alert")).toHaveText("That doesn't look like an email address. Check it and try again.");
  });
});

test("sign-up with an email the owner hasn't added is refused", async ({ page }) => {
  await signUp(page, "Stranger", `stranger-${Date.now()}@example.com`);
  await expect(page.locator("form").getByRole("alert")).toHaveText("Ask the owner to add your email in Settings.");
  await expect(page).toHaveURL(/\/signup$/);
});

test("Settings needs you signed in", async ({ page }) => {
  await page.goto("/settings");
  await expect(page).toHaveURL(/\/signin$/);
});

