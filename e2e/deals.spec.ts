import { expect, test, type Page } from "@playwright/test";
import { OWNER_STATE } from "./owner";

const menu = (page: Page) => page.getByRole("navigation", { name: "Main" });

// The dev server compiles each page on its first visit; every wait for a newly opened page uses this.
const COLD = { timeout: 30_000 };

// Tests share one database, so the open total is read before and after rather than expected outright. Amounts are
// compared in cents, as whole numbers, never as floats.
async function openFigures(page: Page): Promise<{ count: number; cents: bigint }> {
  const dd = page.getByLabel("Open deals", { exact: true }).locator("dd");
  await expect(dd.first()).toBeVisible(COLD);
  const count = Number(await dd.nth(0).textContent());
  const money = (await dd.nth(1).textContent())!; // "$1,250.50"
  expect(money).toMatch(/^\$[\d,]+\.\d{2}$/);
  return { count, cents: BigInt(money.replace(/[^\d]/g, "")) };
}

// The picker works once the page has hydrated; typing before then is tried again.
async function pick(page: Page, box: string, typed: string, option: string | RegExp) {
  const combobox = page.getByRole("combobox", { name: box });
  await expect(async () => {
    await combobox.fill("");
    await combobox.fill(typed);
    await expect(page.getByRole("option", { name: option })).toBeVisible({ timeout: 1_000 });
  }).toPass(COLD);
  await page.getByRole("option", { name: option }).click();
}

test.describe("as the owner", () => {
  test.use({ storageState: OWNER_STATE });

  test("adding, editing and deleting a deal, and the open total following it", async ({ page }) => {
    test.slow(); // several deal pages compile on first visit; COLD bounds each wait, this the whole test
    const stamp = Date.now();
    const title = `Re-roof the hall ${stamp}`;
    const company = `Lynn Tilers ${stamp}`;
    const person = `Wat Tyler ${stamp}`;

    await page.goto("/companies/new");
    await page.getByLabel("Name").fill(company);
    await page.getByRole("button", { name: "Add company" }).click();
    await expect(page.getByRole("heading", { name: company, level: 1 })).toBeVisible(COLD);
    await page.goto("/contacts/new");
    await page.getByLabel("Name").fill(person);
    await page.getByRole("button", { name: "Add contact" }).click();
    await expect(page.getByRole("heading", { name: person, level: 1 })).toBeVisible(COLD);

    await page.goto("/home");
    await menu(page).getByRole("link", { name: "Deals" }).click();
    await expect(page).toHaveURL(/\/deals$/, COLD);
    await expect(page.getByRole("heading", { name: "Deals", level: 1 })).toBeVisible(COLD);
    const before = await openFigures(page);

    await page.getByRole("link", { name: "Add deal" }).click();
    await expect(page.getByRole("heading", { name: "Add deal", level: 1 })).toBeVisible(COLD);
    await expect(page.getByLabel("Stage")).toHaveValue("New"); // a new deal starts at New
    await page.getByLabel("Title").fill(title);
    await page.getByLabel("Value (USD)").fill("12,500.5");
    await pick(page, "Contact", `tyler ${stamp}`, person);
    await pick(page, "Company", `tilers ${stamp}`, company);
    await page.getByLabel("Expected close").fill("2026-11-30");
    await page.getByRole("button", { name: "Add deal" }).click();

    // the deal's own page, with every field; money and dates in the house style
    await expect(page.getByRole("heading", { name: title, level: 1 })).toBeVisible(COLD);
    await expect(page.getByText("$12,500.50", { exact: true })).toBeVisible();
    await expect(page.getByText("New", { exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: person })).toBeVisible();
    await expect(page.getByRole("link", { name: company })).toBeVisible();
    await expect(page.getByText("30 Nov 2026", { exact: true })).toBeVisible();
    // no database ids on the page, only in the address
    const id = new URL(page.url()).pathname.split("/").pop()!;
    await expect(page.locator("main")).not.toContainText(id);

    // it heads the table, and the open figures went up by one deal and its value
    await page.getByRole("link", { name: "Deals", exact: true }).first().click();
    await expect(page.getByRole("heading", { name: "Deals", level: 1 })).toBeVisible(COLD);
    const row = page.getByRole("row").nth(1);
    for (const text of [title, company, "$12,500.50", "New", "30 Nov 2026"]) await expect(row).toContainText(text);
    expect(await openFigures(page)).toEqual({ count: before.count + 1, cents: before.cents + 1_250_050n });

    // moving it to Won takes it out of the open figures
    await page.getByRole("link", { name: title, exact: true }).click();
    await expect(page.getByRole("heading", { name: title, level: 1 })).toBeVisible(COLD);
    await page.getByRole("link", { name: "Edit" }).click();
    await expect(page.getByRole("heading", { name: `Edit ${title}`, level: 1 })).toBeVisible(COLD);
    await expect(page.getByLabel("Value (USD)")).toHaveValue("12500.50");
    await expect(page.getByRole("combobox", { name: "Contact" })).toHaveValue(person);
    await page.getByLabel("Stage").selectOption("Won");
    await page.getByLabel("Value (USD)").fill("13000");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByRole("heading", { name: title, level: 1 })).toBeVisible(COLD);
    await expect(page.getByText("$13,000.00", { exact: true })).toBeVisible();
    await expect(page.getByText("Won", { exact: true })).toBeVisible();
    await page.goto("/deals");
    expect(await openFigures(page)).toEqual(before);

    // Delete asks first. The button opens the dialog only once the page has hydrated, so a click that lands before
    // then is tried again.
    await page.getByRole("link", { name: title, exact: true }).click();
    await expect(page.getByRole("heading", { name: title, level: 1 })).toBeVisible(COLD);
    const dialog = page.getByRole("dialog");
    await expect(async () => {
      await page.getByRole("button", { name: "Delete" }).click();
      await expect(dialog).toBeVisible({ timeout: 1_000 });
    }).toPass(COLD);
    await expect(dialog).toContainText(`Delete ${title}? This can't be undone.`);
    await dialog.getByRole("button", { name: "Delete" }).click();
    await expect(page).toHaveURL(/\/deals$/, COLD);
    await expect(page.getByRole("link", { name: title, exact: true })).toHaveCount(0);
  });

  test("a missing title and a value that can't be stored are explained, and what was typed stays", async ({ page }) => {
    await page.goto("/deals/new");
    await expect(page.getByRole("heading", { name: "Add deal", level: 1 })).toBeVisible(COLD);
    await page.getByLabel("Value (USD)").fill("12.345");
    await page.getByLabel("Stage").selectOption("Proposal");
    await page.getByRole("button", { name: "Add deal" }).click();
    await expect(page.getByText("Enter a title.")).toBeVisible(COLD);
    await expect(page.getByText("Enter at most two decimals, like 1250.50.")).toBeVisible();
    await expect(page.getByLabel("Value (USD)")).toHaveValue("12.345");
    await expect(page.getByLabel("Stage")).toHaveValue("Proposal");
    await expect(page).toHaveURL(/\/deals\/new$/);
  });

  test("a deal that isn't there is not found", async ({ page }) => {
    const res = await page.goto("/deals/00000000-0000-4000-8000-000000000000");
    expect(res?.status()).toBe(404);
  });
});

test.describe("at phone width", () => {
  test.use({ storageState: OWNER_STATE, viewport: { width: 390, height: 844 } });

  test("deals are stacked rows that fit", async ({ page }) => {
    const title = `Lead the chapel windows of Saint Andrew's Hall, every one of them ${Date.now()}`;
    await page.goto("/deals/new");
    await page.getByLabel("Title").fill(title);
    await page.getByLabel("Value (USD)").fill("9999999999.99");
    await page.getByRole("button", { name: "Add deal" }).click();
    await expect(page.getByRole("heading", { name: title, level: 1 })).toBeVisible(COLD);

    await page.goto("/deals");
    await expect(page.getByRole("table")).toBeHidden();
    const block = page.getByRole("list", { name: "Deals" }).getByRole("listitem").filter({ hasText: title });
    await expect(block.getByRole("link").first()).toHaveText(title, COLD);
    await expect(block).toContainText("Value: $9,999,999,999.99");
    await expect(block).toContainText("Stage: New");
    await expect(block).not.toContainText("Company:"); // left blank, so left out

    const fits = await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);
    expect(fits).toBe(true);

    // clean up: this deal's value would swamp the open total other tests read
    await block.getByRole("link").first().click();
    await expect(page.getByRole("heading", { name: title, level: 1 })).toBeVisible(COLD);
    await expect(async () => {
      await page.getByRole("button", { name: "Delete" }).click();
      await expect(page.getByRole("dialog")).toBeVisible({ timeout: 1_000 });
    }).toPass(COLD);
    await page.getByRole("dialog").getByRole("button", { name: "Delete" }).click();
    await expect(page).toHaveURL(/\/deals$/, COLD);
  });
});

test("Deals needs you signed in", async ({ page }) => {
  await page.goto("/deals");
  await expect(page).toHaveURL(/\/signin$/);
});
