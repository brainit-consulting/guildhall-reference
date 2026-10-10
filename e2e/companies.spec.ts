import { expect, test, type Page } from "@playwright/test";
import { OWNER_STATE } from "./owner";

const menu = (page: Page) => page.getByRole("navigation", { name: "Main" });

// The dev server compiles each company page on its first visit, which can take longer than expect's 5s; every wait
// for a newly opened page uses this.
const COLD = { timeout: 30_000 };

test.describe("as the owner", () => {
  test.use({ storageState: OWNER_STATE });

  test("adding, editing and deleting a company", async ({ page }) => {
    test.slow(); // four company pages compile on first visit; COLD bounds each wait, this the whole test
    // tests share one database, so each names its company uniquely
    const name = `Lynn Tilers ${Date.now()}`;
    await page.goto("/home");
    await menu(page).getByRole("link", { name: "Companies" }).click();
    await expect(page).toHaveURL(/\/companies$/, COLD);
    await expect(page.getByRole("heading", { name: "Companies", level: 1 })).toBeVisible(COLD);

    await page.getByRole("link", { name: "Add company" }).click();
    await expect(page.getByRole("heading", { name: "Add company", level: 1 })).toBeVisible(COLD);
    await page.getByLabel("Name").fill(name);
    await page.getByLabel("Website").fill("lynntilers.example");
    await page.getByLabel("Phone").fill("01553 774 100");
    await page.getByLabel("Notes").fill("Roofs for the guildhall.");
    await page.getByRole("button", { name: "Add company" }).click();

    // the company's own page, with every field; the website links out with https added
    await expect(page.getByRole("heading", { name, level: 1 })).toBeVisible(COLD);
    await expect(page.getByRole("link", { name: "lynntilers.example" })).toHaveAttribute("href", "https://lynntilers.example/");
    for (const value of ["01553 774 100", "Roofs for the guildhall."]) {
      await expect(page.getByText(value, { exact: true })).toBeVisible();
    }
    // no database ids on the page, only in the address
    const id = new URL(page.url()).pathname.split("/").pop()!;
    await expect(page.locator("main")).not.toContainText(id);

    // it heads the table
    await page.getByRole("link", { name: "Companies", exact: true }).first().click();
    await expect(page.getByRole("heading", { name: "Companies", level: 1 })).toBeVisible(COLD);
    const firstRow = page.getByRole("row").nth(1);
    await expect(firstRow).toContainText(name);
    await expect(firstRow).toContainText("lynntilers.example");
    await expect(firstRow).toContainText("01553 774 100");

    await page.getByRole("link", { name, exact: true }).click();
    await expect(page.getByRole("heading", { name, level: 1 })).toBeVisible(COLD);
    await page.getByRole("link", { name: "Edit" }).click();
    await expect(page.getByRole("heading", { name: `Edit ${name}`, level: 1 })).toBeVisible(COLD);
    await expect(page.getByLabel("Website")).toHaveValue("lynntilers.example");
    await page.getByLabel("Website").fill("https://lynnmasons.example/roofs");
    await page.getByLabel("Phone").fill("");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByRole("heading", { name, level: 1 })).toBeVisible(COLD);
    await expect(page.getByRole("link", { name: "https://lynnmasons.example/roofs" })).toBeVisible();
    await expect(page.getByText("01553 774 100")).toHaveCount(0);

    // Delete asks first; Cancel keeps the company. The button opens the dialog only once the page has hydrated, so
    // a click that lands before then is tried again.
    const dialog = page.getByRole("dialog");
    await expect(async () => {
      await page.getByRole("button", { name: "Delete" }).click();
      await expect(dialog).toBeVisible({ timeout: 1_000 });
    }).toPass(COLD);
    await expect(dialog).toContainText(`Delete ${name}? This can't be undone.`);
    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(dialog).toBeHidden();
    await expect(page.getByRole("heading", { name, level: 1 })).toBeVisible();

    await page.getByRole("button", { name: "Delete" }).click();
    // Cancel has the focus, so Enter twice can't delete by accident
    await expect(dialog.getByRole("button", { name: "Cancel" })).toBeFocused();
    await dialog.getByRole("button", { name: "Delete" }).click();
    await expect(page).toHaveURL(/\/companies$/, COLD);
    await expect(page.getByRole("heading", { name: "Companies", level: 1 })).toBeVisible(COLD);
    await expect(page.getByRole("link", { name, exact: true })).toHaveCount(0);
  });

  test("a missing name is explained and what was typed stays", async ({ page }) => {
    await page.goto("/companies/new");
    await page.getByLabel("Website").fill("lynntilers.example");
    await page.getByRole("button", { name: "Add company" }).click();
    await expect(page.getByText("Enter a name.")).toBeVisible(COLD);
    await expect(page.getByLabel("Website")).toHaveValue("lynntilers.example");
    await expect(page).toHaveURL(/\/companies\/new$/);
  });

  test("a company that isn't there is not found", async ({ page }) => {
    const res = await page.goto("/companies/00000000-0000-4000-8000-000000000000");
    expect(res?.status()).toBe(404);
  });
});

test.describe("at phone width", () => {
  test.use({ storageState: OWNER_STATE, viewport: { width: 390, height: 844 } });

  test("companies are stacked rows that fit, even with a long website", async ({ page }) => {
    const name = `Norwich Glaziers ${Date.now()}`;
    const website = "https://www.norwich-glaziers-and-leadworkers-of-saint-andrews-hall.example/about-us";
    await page.goto("/companies/new");
    await page.getByLabel("Name").fill(name);
    await page.getByLabel("Website").fill(website);
    await page.getByRole("button", { name: "Add company" }).click();
    await expect(page.getByRole("heading", { name, level: 1 })).toBeVisible(COLD);

    await page.goto("/companies");
    // no table under 768px: one block per company, the name first as the link, then "Label: value" lines
    await expect(page.getByRole("table")).toBeHidden();
    const block = page.getByRole("list", { name: "Companies" }).getByRole("listitem").filter({ hasText: name });
    await expect(block.getByRole("link").first()).toHaveText(name, COLD);
    await expect(block).toContainText(`Website: ${website}`);
    await expect(block).not.toContainText("Phone:"); // left blank, so left out

    const fits = await block.evaluate((li) => {
      const html = document.documentElement;
      return li.scrollWidth <= li.clientWidth && html.scrollWidth <= html.clientWidth;
    });
    expect(fits).toBe(true);
  });
});

test("Companies needs you signed in", async ({ page }) => {
  await page.goto("/companies");
  await expect(page).toHaveURL(/\/signin$/);
});
