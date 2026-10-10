import { expect, test, type Page } from "@playwright/test";
import { allowSignUp, OWNER_STATE } from "./owner";

const DESKTOP = { width: 1280, height: 800 };
const PHONE = { width: 390, height: 844 };

const menu = (page: Page) => page.getByRole("navigation", { name: "Main" });

async function fitsSideways(page: Page) {
  return page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);
}

test.describe("as the owner", () => {
  test.use({ storageState: OWNER_STATE });

  test("moving between Home and Settings at desktop width", async ({ page }) => {
    await page.setViewportSize(DESKTOP);
    await page.goto("/home");
    // down the left: the menu sits beside the page, not above it
    const box = await menu(page).boundingBox();
    expect(box!.x + box!.width).toBeLessThanOrEqual(260);
    await expect(page.getByRole("button", { name: "Menu" })).toBeHidden();
    await expect(menu(page).getByRole("link", { name: "Home" })).toHaveAttribute("aria-current", "page");

    await menu(page).getByRole("link", { name: "Settings" }).click();
    await expect(page).toHaveURL(/\/settings$/);
    await expect(page.getByRole("heading", { name: "Settings", level: 1 })).toBeVisible();
    const settings = menu(page).getByRole("link", { name: "Settings" });
    await expect(settings).toHaveAttribute("aria-current", "page");
    await expect(menu(page).getByRole("link", { name: "Home" })).not.toHaveAttribute("aria-current");
    // the current item is in the accent colour, the others in ink
    const colours = await page.evaluate(() => {
      const css = getComputedStyle(document.documentElement);
      const probe = document.createElement("span");
      document.body.append(probe);
      const resolve = (v: string) => {
        probe.style.color = css.getPropertyValue(v).trim();
        return getComputedStyle(probe).color;
      };
      return { accent: resolve("--accent"), ink: resolve("--ink") };
    });
    await expect(settings).toHaveCSS("color", colours.accent);
    await expect(menu(page).getByRole("link", { name: "Home" })).toHaveCSS("color", colours.ink);

    await menu(page).getByRole("link", { name: "Home" }).click();
    await expect(page).toHaveURL(/\/home$/);
    await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();
    expect(await fitsSideways(page)).toBe(true);
  });

  test("moving between Home and Settings at phone width", async ({ page }) => {
    await page.setViewportSize(PHONE);
    await page.goto("/home");
    const toggle = page.getByRole("button", { name: "Menu" });
    // a bar across the top, closed
    const bar = await page.locator("header").boundingBox();
    expect(bar!.y).toBe(0);
    expect(bar!.width).toBe(PHONE.width);
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await expect(menu(page)).toBeHidden();
    expect(await fitsSideways(page)).toBe(true);

    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
    await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();
    await menu(page).getByRole("link", { name: "Settings" }).click();
    await expect(page).toHaveURL(/\/settings$/);
    await expect(page.getByRole("heading", { name: "Settings", level: 1 })).toBeVisible();
    // choosing a page closes the menu again
    await expect(menu(page)).toBeHidden();
    expect(await fitsSideways(page)).toBe(true);

    await toggle.click();
    await expect(menu(page).getByRole("link", { name: "Settings" })).toHaveAttribute("aria-current", "page");
    await toggle.click();
    await expect(menu(page)).toBeHidden();
    await toggle.click();
    await menu(page).getByRole("link", { name: "Home" }).click();
    await expect(page).toHaveURL(/\/home$/);
    await expect(page.getByRole("heading", { name: /^Welcome, / })).toBeVisible();
  });
});

test("someone who isn't the owner has no Settings in the menu", async ({ page, browser }) => {
  const email = `cecily-${Date.now()}@lynn.example`;
  await allowSignUp(browser, email);
  await page.goto("/signup");
  await page.getByLabel("Name").fill("Cecily Neville");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("cloth and wool");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/home$/);

  await expect(menu(page).getByRole("link", { name: "Home" })).toBeVisible();
  await expect(menu(page).getByRole("link", { name: "Settings" })).toHaveCount(0);

  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/signin$/);
});
