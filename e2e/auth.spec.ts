import { expect, test } from "@playwright/test";

test("sign up, sign out and sign back in", async ({ page }) => {
  const email = `ada-${Date.now()}@example.com`;

  await page.goto("/");
  await page.getByRole("link", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/signup$/);
  await page.getByLabel("Name").fill("Ada Lovelace");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("analytical engine");
  await page.getByRole("button", { name: "Create account" }).click();

  await expect(page).toHaveURL(/\/home$/);
  await expect(page.getByRole("heading", { name: "Welcome, Ada Lovelace." })).toBeVisible();

  // signed in, the welcome page and the forms send you home
  await page.goto("/");
  await expect(page).toHaveURL(/\/home$/);

  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/signin$/);

  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("wrong password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.locator("form").getByRole("alert")).toHaveText(/That email and password don't match\./);

  await page.getByLabel("Password").fill("analytical engine");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/home$/);
  await expect(page.getByRole("heading", { name: "Welcome, Ada Lovelace." })).toBeVisible();
});

test("home needs you signed in", async ({ page }) => {
  await page.goto("/home");
  await expect(page).toHaveURL(/\/signin$/);
});

test("mistakes on sign-up are explained next to the form", async ({ page }) => {
  await page.goto("/signup");
  await page.getByLabel("Name").fill("Short");
  await page.getByLabel("Email").fill(`short-${Date.now()}@example.com`);
  await page.getByLabel("Password").fill("1234567");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.locator("form").getByRole("alert")).toHaveText("The password needs at least 8 characters.");
  await expect(page).toHaveURL(/\/signup$/);

  await page.getByRole("link", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/signin$/);
});
