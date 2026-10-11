import { expect, test } from "@playwright/test";
import { BUSINESS_NAME } from "../src/lib/brand";
import { OWNER_STATE } from "./owner";

// The dev server compiles each page on its first visit; every wait for a newly opened page uses this.
const COLD = { timeout: 30_000 };

// Titles come from the root layout's template, so the name is read from brand.ts, never typed here.
test.describe("signed out", () => {
  test("the welcome tab is the bare name", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(BUSINESS_NAME, COLD);
  });

  test("sign-in and the enquiry form end in the name", async ({ page }) => {
    await page.goto("/signin");
    await expect(page).toHaveTitle(`Sign in · ${BUSINESS_NAME}`, COLD);
    await expect(page.getByText(`Welcome back to ${BUSINESS_NAME}.`)).toBeVisible();

    await page.goto("/signup");
    await expect(page).toHaveTitle(`Create account · ${BUSINESS_NAME}`, COLD);
    await expect(page.getByText(`Create your account for ${BUSINESS_NAME}.`)).toBeVisible();

    await page.goto("/enquire");
    await expect(page).toHaveTitle(`Ask for a quote · ${BUSINESS_NAME}`, COLD);
  });
});

test.describe("signed in", () => {
  test.use({ storageState: OWNER_STATE });

  test("a list and a deal you add end in the name", async ({ page }) => {
    await page.goto("/contacts");
    await expect(page).toHaveTitle(`Contacts · ${BUSINESS_NAME}`, COLD);

    const title = `Oak dresser ${Date.now()}`;
    await page.goto("/deals/new");
    await page.getByLabel("Title").fill(title);
    await page.getByRole("button", { name: "Add deal" }).click();
    await expect(page.getByRole("heading", { name: title, level: 1 })).toBeVisible(COLD);
    await expect(page).toHaveTitle(`${title} · ${BUSINESS_NAME}`);
  });
});
