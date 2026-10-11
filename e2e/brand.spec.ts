import { expect, test, type Page } from "@playwright/test";
import { BRAND_LOGO, BUSINESS_NAME } from "../src/lib/brand";
import { OWNER_STATE } from "./owner";

// The dev server compiles each page on its first visit; every wait for a newly opened page uses this.
const COLD = { timeout: 30_000 };

// The image has loaded, not just been put on the page.
async function loaded(page: Page, selector: string) {
  return page.locator(selector).first().evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0);
}

test.describe("signed out", () => {
  test("the welcome page shows the logo above the name", async ({ page }) => {
    await page.goto("/");
    const heading = page.getByRole("heading", { name: BUSINESS_NAME, level: 1 });
    await expect(heading).toBeVisible(COLD);
    await expect(page.getByText("Nothing here yet")).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Sign in" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Create account" })).toBeVisible();

    test.skip(BRAND_LOGO === null, "no logo in this copy");
    // decorative: the heading says the same words, so the image adds nothing for a screen reader
    const logo = page.locator(`main img[src="${BRAND_LOGO}"]`);
    await expect(logo).toHaveAttribute("alt", "");
    expect(await loaded(page, `main img[src="${BRAND_LOGO}"]`)).toBe(true);
    const [logoBox, headingBox] = [await logo.boundingBox(), await heading.boundingBox()];
    expect(logoBox!.height).toBe(64);
    expect(logoBox!.y + logoBox!.height).toBeLessThanOrEqual(headingBox!.y);
  });

  test("the tab icon is served as an image", async ({ page, request }) => {
    test.skip(BRAND_LOGO === null, "no logo in this copy");
    await page.goto("/");
    const href = await page.locator('head link[rel="icon"]').first().getAttribute("href", COLD);
    expect(href).toBeTruthy();
    const res = await request.get(href!);
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toMatch(/^image\//);
  });
});

test.describe("signed in", () => {
  test.use({ storageState: OWNER_STATE });

  for (const size of [{ width: 390, height: 844 }, { width: 1280, height: 800 }]) {
    test(`the menu shows the logo and the name at ${size.width}px`, async ({ page }) => {
      await page.setViewportSize(size);
      await page.goto("/home");
      const header = page.locator("header").first();
      if (BRAND_LOGO === null) {
        await expect(header.getByText(BUSINESS_NAME, { exact: true })).toBeVisible(COLD);
      } else {
        // the image carries the name; the visible name beside it is hidden from screen readers so it's read once
        await expect(header.getByRole("img", { name: BUSINESS_NAME, exact: true })).toBeVisible(COLD);
        expect(await loaded(page, `header img[src="${BRAND_LOGO}"]`)).toBe(true);
        await expect(header.getByText(BUSINESS_NAME, { exact: true })).toHaveAttribute("aria-hidden", "true");
      }
      await expect(header.getByText(BUSINESS_NAME, { exact: true })).toBeVisible();
      if (size.width < 768) {
        await expect(page.getByRole("button", { name: "Menu" })).toBeInViewport();
        // the top bar keeps its h-14 (3.5rem) height, however long the name
        const rem = await page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).fontSize));
        expect((await header.locator("> div").first().boundingBox())!.height).toBe(3.5 * rem);
      }
      const fits = await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);
      expect(fits).toBe(true);
    });
  }
});
