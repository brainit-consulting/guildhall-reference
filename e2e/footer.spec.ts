import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { BUSINESS_NAME } from "../src/lib/brand";
import { allowSignUp, OWNER_STATE } from "./owner";

// The dev server compiles each page on its first visit; every wait for a newly opened page uses this.
const COLD = { timeout: 30_000 };
const VERSION = `Version ${JSON.parse(readFileSync("package.json", "utf8")).version}`;

// Name, year and version, in the muted colour; on a short page its bottom edge is the screen's.
async function expectFooter(page: Page) {
  const footer = page.getByRole("contentinfo");
  await expect(footer).toBeVisible(COLD);
  for (const part of [BUSINESS_NAME, String(new Date().getFullYear()), VERSION]) await expect(footer).toContainText(part);
  const [colour, expected] = await footer.evaluate((el) => {
    const probe = document.createElement("span");
    probe.style.color = "var(--color-muted)";
    document.body.append(probe);
    const want = getComputedStyle(probe).color;
    probe.remove();
    return [getComputedStyle(el).color, want];
  });
  expect(colour).toBe(expected);
  return footer;
}

async function sitsAtTheFoot(page: Page) {
  const box = (await page.getByRole("contentinfo").boundingBox())!;
  const { height } = page.viewportSize()!;
  const scrolls = await page.evaluate(() => document.documentElement.scrollHeight > window.innerHeight);
  // a page taller than the screen puts the footer below its content instead
  if (!scrolls) expect(Math.round(box.y + box.height)).toBe(height);
}

test.describe("signed out", () => {
  test("the welcome page shows the version in the footer", async ({ page }) => {
    await page.goto("/");
    await expectFooter(page);
    await sitsAtTheFoot(page);
    await expect(page.getByRole("contentinfo").getByRole("link", { name: "Settings" })).toHaveCount(0);
  });

  test("sign-in shows the footer", async ({ page }) => {
    await page.goto("/signin");
    await expectFooter(page);
    await sitsAtTheFoot(page);
  });
});

test.describe("signed in", () => {
  test.use({ storageState: OWNER_STATE });

  for (const size of [{ width: 390, height: 844 }, { width: 1280, height: 800 }]) {
    test(`Home shows the footer with Settings for the owner at ${size.width}px`, async ({ page }) => {
      await page.setViewportSize(size);
      await page.goto("/home");
      const footer = await expectFooter(page);
      await footer.getByRole("link", { name: "Settings" }).click();
      await expect(page).toHaveURL(/\/settings$/, COLD);
    });
  }

  test("a short page keeps the footer at the screen's foot", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 1400 });
    await page.goto("/companies/new");
    await expectFooter(page);
    await sitsAtTheFoot(page);
  });
});

test("a member's footer has no Settings link", async ({ browser, page }) => {
  const email = `cooper-${Date.now()}@lynn.example`;
  await allowSignUp(browser, email);
  await page.goto("/signup");
  await page.getByLabel("Name").fill("Joan Cooper");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("barrel and hoop");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/home$/, COLD);
  const footer = await expectFooter(page);
  await expect(footer.getByRole("link", { name: "Settings" })).toHaveCount(0);
});
