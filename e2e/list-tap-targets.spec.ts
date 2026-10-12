import { expect, test, type Page } from "@playwright/test";
import { OWNER_STATE } from "./owner";

// The dev server compiles each page on its first visit; every wait for a newly opened page uses this.
const COLD = { timeout: 30_000 };
const PAGES = ["/contacts", "/companies", "/deals"];

// The picker works once the page has hydrated; typing before then is tried again.
async function pick(page: Page, label: string, typed: string, option: string) {
  const box = page.getByRole("combobox", { name: label });
  await expect(async () => {
    await box.fill("");
    await box.fill(typed);
    await expect(page.getByRole("option", { name: option })).toBeVisible({ timeout: 1_000 });
  }).toPass(COLD);
  await page.getByRole("option", { name: option }).click();
}

// Every control in the page's main part smaller than 44x44, measured the way the phone-ready check does: a link
// inline in a sentence ("No matches. Clear search") is left out, as are checkboxes.
const undersized = (page: Page) => page.locator("main").evaluate((main) => {
  const small: string[] = [];
  for (const e of main.querySelectorAll<HTMLElement>("a[href], button, input:not([type=hidden]), select, textarea, summary")) {
    const r = e.getBoundingClientRect();
    if (r.width === 0 || r.height === 0 || e.matches("input[type=checkbox], input[type=radio]")) continue;
    const inSentence = e.tagName === "A" && getComputedStyle(e).display === "inline"
      && (e.parentElement?.innerText ?? "").trim().length > e.innerText.trim().length;
    if (!inSentence && (r.width < 44 || r.height < 44)) small.push(`${e.innerText || e.tagName} ${Math.round(r.width)}x${Math.round(r.height)}`);
  }
  return small;
});

test.describe("as the owner", () => {
  test.use({ storageState: OWNER_STATE });

  // Short names, so the name links are narrower than a thumb as well as shorter; each linked to a company.
  test.beforeAll(async ({ browser }) => {
    test.setTimeout(180_000);
    const context = await browser.newContext({ storageState: OWNER_STATE });
    const page = await context.newPage();
    const company = `Ox ${Date.now() % 1000}`;
    await page.goto("/companies/new");
    await page.getByLabel("Name").fill(company);
    await page.getByRole("button", { name: "Add company" }).click();
    await expect(page.getByRole("heading", { name: company, level: 1 })).toBeVisible(COLD);

    await page.goto("/contacts/new");
    await page.getByLabel("Name").fill("Al");
    await pick(page, "Company", company, company);
    await page.getByRole("button", { name: "Add contact" }).click();
    await expect(page.getByRole("heading", { name: "Al", level: 1, exact: true })).toBeVisible(COLD);

    await page.goto("/deals/new");
    await page.getByLabel("Title").fill("Do");
    await pick(page, "Company", company, company);
    await page.getByRole("button", { name: "Add deal" }).click();
    await expect(page.getByRole("heading", { name: "Do", level: 1, exact: true })).toBeVisible(COLD);
    await context.close();
  });

  // A phone upright (stacked rows and Sort by), a phone sideways and a tablet (tables with sorting headings).
  for (const { width, height, isMobile } of [
    { width: 375, height: 667, isMobile: true }, { width: 844, height: 390, isMobile: false }, { width: 810, height: 1080, isMobile: false },
  ]) {
    test.describe(`on a touch screen at ${width}x${height}`, () => {
      test.use({ viewport: { width, height }, hasTouch: true, isMobile });

      for (const path of PAGES) {
        test(`every control on ${path} is at least 44x44`, async ({ page }) => {
          await page.goto(path);
          await expect(page.getByRole("searchbox", { name: "Search" })).toBeVisible(COLD);
          // the Sort by choices too, where the list has them instead of headings
          const sortBy = page.locator("details").filter({ hasText: "Sort by:" });
          if (await sortBy.isVisible()) await sortBy.locator("summary").click();
          expect(await undersized(page)).toEqual([]);
        });
      }
    });
  }

  // A mouse keeps the desktop sizes: the headings and names stay their own size.
  test.describe("at 1280x800 with a mouse", () => {
    test.use({ viewport: { width: 1280, height: 800 } });

    test("the contacts table keeps its desktop sizes", async ({ page }) => {
      await page.goto("/contacts");
      const heading = page.getByRole("columnheader", { name: "Name" }).getByRole("link");
      await expect(heading).toBeVisible(COLD);
      expect((await heading.boundingBox())!.width).toBeLessThan(44);
      const name = page.getByRole("table").getByRole("link", { name: "Al", exact: true }).first();
      expect(await name.evaluate((e) => getComputedStyle(e).display)).toBe("inline");
    });
  });
});
