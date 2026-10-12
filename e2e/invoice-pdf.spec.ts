import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { OWNER_STATE } from "./owner";

// The dev server compiles each page on its first visit; every wait for a newly opened page uses this.
const COLD = { timeout: 30_000 };

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

async function setAddress(page: Page, address: string) {
  await page.goto("/settings");
  await page.getByLabel("Your address").fill(address);
  await pressUntil(page, "Save address", () => expect(page.getByRole("status").filter({ hasText: "Invoice PDFs show this address" })).toBeVisible({ timeout: 2_000 }));
}

test.describe("as the owner", () => {
  test.use({ storageState: OWNER_STATE });

  test("the address goes in Settings, and Download PDF saves INV-….pdf", async ({ page }) => {
    test.slow(); // several pages compile on first visit
    const stamp = Date.now();
    const company = `Elm Yard ${stamp}`;
    const deal = `Elm benches ${stamp}`;

    // a refused address stays in the box to be fixed
    await page.goto("/settings");
    await page.getByLabel("Your address").fill(Array.from({ length: 7 }, (_, n) => `Line ${n + 1}`).join("\n"));
    await pressUntil(page, "Save address", () => expect(page.getByRole("alert").filter({ hasText: "Fit the address" })).toHaveText("Fit the address on 6 lines or fewer.", { timeout: 2_000 }));
    await expect(page.getByLabel("Your address")).toHaveValue(/Line 7$/);
    await setAddress(page, "  12 Mill Lane \n\nHollow Oak, VT 05001");
    await page.reload();
    await expect(page.getByLabel("Your address")).toHaveValue("12 Mill Lane\nHollow Oak, VT 05001", COLD);

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

    await page.getByRole("link", { name: "New invoice" }).click();
    await expect(page.getByRole("heading", { name: "New invoice", level: 1 })).toBeVisible(COLD);
    const line = page.getByRole("listitem", { name: "Line 1" });
    await line.getByLabel("Description").fill("Elm bench");
    await line.getByLabel("Quantity").fill("2");
    await line.getByLabel("Unit price (USD)").fill("640");
    await pressUntil(page, "Save draft", () => expect(page.getByRole("heading", { name: /^INV-\d{4,}$/, level: 1 })).toBeVisible({ timeout: 5_000 }));
    const number = await page.getByRole("heading", { level: 1 }).innerText();

    const [download] = await Promise.all([
      page.waitForEvent("download", COLD),
      page.getByRole("link", { name: "Download PDF" }).click(),
    ]);
    expect(download.suggestedFilename()).toBe(`${number}.pdf`);
    expect(readFileSync((await download.path())!).subarray(0, 5).toString("latin1")).toBe("%PDF-");
    // still on the invoice
    await expect(page.getByRole("heading", { name: number, level: 1 })).toBeVisible();

    // tidy up: a Draft can be deleted, then the deal; the address goes back to blank for other tests
    await pressUntil(page, "Delete", () => expect(page.getByRole("dialog")).toBeVisible({ timeout: 1_000 }));
    await page.getByRole("dialog").getByRole("button", { name: "Delete" }).click();
    await expect(page).toHaveURL(/\/invoices$/, COLD);
    await page.goto(dealPath);
    await pressUntil(page, "Delete", () => expect(page.getByRole("dialog")).toBeVisible({ timeout: 1_000 }));
    await page.getByRole("dialog").getByRole("button", { name: "Delete" }).click();
    await expect(page).toHaveURL(/\/deals$/, COLD);
    await setAddress(page, "");
  });
});

test("signed out, an invoice PDF sends you to sign in", async ({ page }) => {
  await page.goto("/invoices/6f1c2a3e-1d2b-4c5d-8e9f-0a1b2c3d4e5f/pdf");
  await expect(page).toHaveURL(/\/signin/, COLD);
});
