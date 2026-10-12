import { expect, test, type Page } from "@playwright/test";
import { OWNER_STATE } from "./owner";

const menu = (page: Page) => page.getByRole("navigation", { name: "Main" });

// The dev server compiles each page on its first visit; every wait for a newly opened page uses this.
const COLD = { timeout: 30_000 };

// The picker works once the page has hydrated; typing before then is tried again.
async function pick(page: Page, box: string, typed: string) {
  const combobox = page.getByRole("combobox", { name: box });
  await expect(async () => {
    await combobox.fill("");
    await combobox.fill(typed);
    await expect(page.getByRole("option", { name: typed })).toBeVisible({ timeout: 1_000 });
  }).toPass(COLD);
  await page.getByRole("option", { name: typed }).click();
}

// Clicks once the page has hydrated: a form's action only runs then.
async function pressUntil(page: Page, button: string, then: () => Promise<void>) {
  await expect(async () => {
    await page.getByRole("button", { name: button }).click();
    await then();
  }).toPass(COLD);
}

async function setTaxRate(page: Page, rate: string) {
  await page.goto("/settings");
  await page.getByLabel("Tax rate (%)").fill(rate);
  await pressUntil(page, "Save tax rate", () => expect(page.getByRole("status").filter({ hasText: "Saved" })).toBeVisible({ timeout: 2_000 }));
}

test.describe("as the owner", () => {
  test.use({ storageState: OWNER_STATE });

  test("make an invoice with three lines from a client's page, see the totals, mark it sent, then paid", async ({ page }) => {
    test.slow(); // several pages compile on first visit
    const stamp = Date.now();
    const company = `Wren Joinery ${stamp}`;
    const deal = `Wren shelving ${stamp}`;

    await setTaxRate(page, "15");

    // a client, made the way the app makes one: a Won deal of a company
    await page.goto("/companies/new");
    await page.getByLabel("Name").fill(company);
    await page.getByRole("button", { name: "Add company" }).click();
    await expect(page.getByRole("heading", { name: company, level: 1 })).toBeVisible(COLD);
    await page.goto("/deals/new");
    await page.getByLabel("Title").fill(deal);
    await page.getByLabel("Stage").selectOption("Won");
    await pick(page, "Company", company);
    await page.getByRole("button", { name: "Add deal" }).click();
    await expect(page.getByRole("heading", { name: deal, level: 1 })).toBeVisible(COLD);
    const dealPath = new URL(page.url()).pathname;
    await pressUntil(page, "Make client", () => expect(page.getByRole("heading", { name: company, level: 1 })).toBeVisible({ timeout: 2_000 }));
    const clientPath = new URL(page.url()).pathname;
    await expect(page.getByText("No invoices for this client yet.")).toBeVisible();

    // New invoice, with the client already picked
    await page.getByRole("link", { name: "New invoice" }).click();
    await expect(page.getByRole("heading", { name: "New invoice", level: 1 })).toBeVisible(COLD);
    await expect(page.getByLabel("Client").locator("option:checked")).toHaveText(company);
    await page.getByLabel("Issue date").fill("2026-10-12");
    await page.getByLabel("Due date").fill("2026-11-11");

    // three lines, two of them a half cent (67.875, 22.625): each rounds up and the subtotal is what the lines add to
    const line = (n: number) => page.getByRole("listitem", { name: `Line ${n}` });
    await expect(async () => {
      if (await line(3).count() === 0) await page.getByRole("button", { name: "Add line" }).click();
      await expect(line(3)).toBeVisible({ timeout: 1_000 });
    }).toPass(COLD);
    const rows = [["Oak shelves", "3", "120"], ["Fitting, hours", "1.5", "45.25"], ["Finishing, hours", "0.5", "45.25"]];
    for (const [i, [description, quantity, price]] of rows.entries()) {
      await line(i + 1).getByLabel("Description").fill(description);
      await line(i + 1).getByLabel("Quantity").fill(quantity);
      await line(i + 1).getByLabel("Unit price (USD)").fill(price);
    }
    await expect(page.getByRole("status", { name: "Line 2 amount" })).toHaveText("$67.88");
    const totals = page.getByRole("definition");
    await expect(totals).toHaveText(["$450.51", "$67.58", "$518.09"]);
    await page.getByRole("button", { name: "Save draft" }).click();

    // the invoice's page
    await expect(page.getByRole("heading", { name: /^INV-\d{4,}$/, level: 1 })).toBeVisible(COLD);
    const number = await page.getByRole("heading", { level: 1 }).innerText();
    const invoicePath = new URL(page.url()).pathname;
    await expect(page.getByRole("definition").first()).toHaveText(company);
    await expect(page.getByRole("definition").nth(2)).toHaveText("Draft");
    const lines = page.getByRole("table", { name: "Lines" }).getByRole("row");
    await expect(lines.nth(1).getByRole("cell")).toHaveText(["Oak shelves", "3", "$120.00", "$360.00"]);
    await expect(lines.nth(2).getByRole("cell")).toHaveText(["Fitting, hours", "1.5", "$45.25", "$67.88"]);
    await expect(lines.nth(3).getByRole("cell")).toHaveText(["Finishing, hours", "0.5", "$45.25", "$22.63"]);
    await expect(page.getByLabel("Totals").getByRole("definition")).toHaveText(["$450.51", "$67.58", "$518.09"]);
    await expect(page.getByLabel("Totals").getByRole("term").nth(1)).toHaveText("Tax (15%)");

    // a later change to the tax rate leaves this invoice's alone
    await setTaxRate(page, "20");
    await page.goto(invoicePath);
    await expect(page.getByLabel("Totals").getByRole("definition")).toHaveText(["$450.51", "$67.58", "$518.09"], COLD);

    // on /invoices, opened from the menu
    await page.goto("/home");
    await menu(page).getByRole("link", { name: "Invoices" }).click();
    await expect(page.getByRole("heading", { name: "Invoices", level: 1 })).toBeVisible(COLD);
    const row = page.getByRole("table", { name: "Invoices" }).getByRole("row").filter({ hasText: number });
    await expect(row.getByRole("cell")).toHaveText([number, company, "$518.09", "Draft", "11 Nov 2026"]);

    // Mark sent: Edit and Delete go
    await page.goto(invoicePath);
    await pressUntil(page, "Mark sent", () => expect(page.getByRole("button", { name: "Mark paid" })).toBeVisible({ timeout: 2_000 }));
    await expect(page.getByRole("definition").nth(2)).toHaveText("Sent");
    await expect(page.getByRole("link", { name: "Edit" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Delete" })).toHaveCount(0);

    // Mark paid
    await page.getByRole("button", { name: "Mark paid" }).click();
    await expect(page.getByRole("definition").nth(2)).toHaveText("Paid", COLD);
    await expect(page.getByRole("button", { name: /^Mark/ })).toHaveCount(0);

    // on the client's page
    await page.goto(clientPath);
    const listed = page.getByRole("list", { name: "Invoices" }).getByRole("listitem");
    await expect(listed).toHaveCount(1, COLD);
    await expect(listed).toContainText(number);
    await expect(listed).toContainText("Paid · due 11 Nov 2026");
    await expect(listed).toContainText("$518.09");

    // so other tests' figures stay as they were. A paid invoice can't be deleted, so the client stays; the deal goes.
    await setTaxRate(page, "0");
    await page.goto(dealPath);
    await pressUntil(page, "Delete", () => expect(page.getByRole("dialog")).toBeVisible({ timeout: 1_000 }));
    await page.getByRole("dialog").getByRole("button", { name: "Delete" }).click();
    await expect(page).toHaveURL(/\/deals$/, COLD);
  });

  test("a Draft can be edited and deleted; a line left wrong says why", async ({ page }) => {
    test.slow();
    const stamp = Date.now();
    const company = `Ash Lane ${stamp}`;
    const deal = `Ash table ${stamp}`;

    await page.goto("/companies/new");
    await page.getByLabel("Name").fill(company);
    await page.getByRole("button", { name: "Add company" }).click();
    await expect(page.getByRole("heading", { name: company, level: 1 })).toBeVisible(COLD);
    await page.goto("/deals/new");
    await page.getByLabel("Title").fill(deal);
    await page.getByLabel("Stage").selectOption("Won");
    await pick(page, "Company", company);
    await page.getByRole("button", { name: "Add deal" }).click();
    await expect(page.getByRole("heading", { name: deal, level: 1 })).toBeVisible(COLD);
    const dealPath = new URL(page.url()).pathname;
    await pressUntil(page, "Make client", () => expect(page.getByRole("heading", { name: company, level: 1 })).toBeVisible({ timeout: 2_000 }));

    // from /invoices, picking the client there
    await page.goto("/invoices");
    await page.getByRole("link", { name: "New invoice" }).click();
    await expect(page.getByRole("heading", { name: "New invoice", level: 1 })).toBeVisible(COLD);
    await page.getByLabel("Client").selectOption({ label: company });
    const line = page.getByRole("listitem", { name: "Line 1" });
    await line.getByLabel("Description").fill("Ash table");
    await line.getByLabel("Quantity").fill("0");
    await line.getByLabel("Unit price (USD)").fill("900");
    await pressUntil(page, "Save draft", () => expect(line.getByRole("alert")).toHaveText("Enter a quantity above 0.", { timeout: 2_000 }));
    await expect(line.getByLabel("Description")).toHaveValue("Ash table");
    await line.getByLabel("Quantity").fill("1");
    await page.getByRole("button", { name: "Save draft" }).click();
    await expect(page.getByRole("heading", { name: /^INV-\d{4,}$/, level: 1 })).toBeVisible(COLD);
    const number = await page.getByRole("heading", { level: 1 }).innerText();

    // Edit
    await page.getByRole("link", { name: "Edit" }).click();
    await expect(page.getByRole("heading", { name: `Edit ${number}`, level: 1 })).toBeVisible(COLD);
    // the stored quantity shows as typed, not "1.00"
    await expect(page.getByRole("listitem", { name: "Line 1" }).getByLabel("Quantity")).toHaveValue("1");
    await expect(async () => {
      await page.getByRole("listitem", { name: "Line 1" }).getByLabel("Unit price (USD)").fill("950");
      await expect(page.getByLabel("Totals").getByRole("definition").first()).toHaveText("$950.00", { timeout: 1_000 });
    }).toPass(COLD);
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByRole("heading", { name: number, level: 1 })).toBeVisible(COLD);
    await expect(page.getByLabel("Totals").getByRole("definition").first()).toHaveText("$950.00");

    // Delete asks first
    await pressUntil(page, "Delete", () => expect(page.getByRole("dialog")).toBeVisible({ timeout: 1_000 }));
    await page.getByRole("dialog").getByRole("button", { name: "Delete" }).click();
    await expect(page).toHaveURL(/\/invoices$/, COLD);
    await expect(page.getByRole("link", { name: number })).toHaveCount(0);

    await page.goto(dealPath);
    await pressUntil(page, "Delete", () => expect(page.getByRole("dialog")).toBeVisible({ timeout: 1_000 }));
    await page.getByRole("dialog").getByRole("button", { name: "Delete" }).click();
    await expect(page).toHaveURL(/\/deals$/, COLD);
  });
});
