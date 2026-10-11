import { expect, test, type Page } from "@playwright/test";
import { OWNER_STATE } from "./owner";

// The dev server compiles each page on its first visit; every wait for a newly opened page uses this.
const COLD = { timeout: 30_000 };

async function addCompany(page: Page, name: string) {
  await page.goto("/companies/new");
  await page.getByLabel("Name").fill(name);
  await page.getByRole("button", { name: "Add company" }).click();
  await expect(page.getByRole("heading", { name, level: 1 })).toBeVisible(COLD);
}

// The picker works once the page has hydrated; typing before then is tried again.
async function pickCompany(page: Page, typed: string, option: string) {
  const box = page.getByRole("combobox", { name: "Company" });
  await expect(async () => {
    await box.fill("");
    await box.fill(typed);
    await expect(page.getByRole("option", { name: option })).toBeVisible({ timeout: 1_000 });
  }).toPass(COLD);
  await page.getByRole("option", { name: option }).click();
}

test.describe("as the owner", () => {
  test.use({ storageState: OWNER_STATE });

  test("putting a contact in a company, then deleting the company", async ({ page }) => {
    test.slow(); // several pages compile on first visit; COLD bounds each wait, this the whole test
    // tests share one database, so names are unique
    const stamp = Date.now();
    const company = `Lynn Tilers ${stamp}`;
    const other = `Norwich Masons ${stamp}`;
    const person = `Wat Tyler ${stamp}`;
    await addCompany(page, other);
    await addCompany(page, company);

    // pick it on the contact form by typing part of its name; the other company is filtered out
    await page.goto("/contacts/new");
    await page.getByLabel("Name").fill(person);
    await page.getByLabel("Job title").fill("Master tiler");
    await pickCompany(page, `tilers ${stamp}`, company);
    await expect(page.getByRole("combobox", { name: "Company" })).toHaveValue(company);
    // and by keyboard: typing narrows the list, Enter picks the first match
    await page.getByRole("combobox", { name: "Company" }).click();
    await page.getByRole("combobox", { name: "Company" }).fill(`tilers ${stamp}`);
    await expect(page.getByRole("option", { name: other })).toHaveCount(0);
    await page.getByRole("combobox", { name: "Company" }).press("Enter"); // picks, doesn't submit
    await expect(page.getByRole("heading", { name: "Add contact", level: 1 })).toBeVisible();
    await page.getByRole("button", { name: "Add contact" }).click();

    // the contact's page links to the company
    await expect(page.getByRole("heading", { name: person, level: 1 })).toBeVisible(COLD);
    await expect(page.getByRole("link", { name: company })).toBeVisible();

    // the contacts table shows it, linked
    await page.goto("/contacts");
    const row = page.getByRole("row").filter({ hasText: person });
    await expect(row.getByRole("link", { name: company })).toBeVisible(COLD);
    await row.getByRole("link", { name: company }).click();

    // the company's page lists the contact
    await expect(page.getByRole("heading", { name: company, level: 1 })).toBeVisible(COLD);
    const people = page.getByRole("list", { name: "Contacts" });
    await expect(people.getByRole("link", { name: person })).toBeVisible();
    await expect(people).toContainText("Master tiler");
    const id = new URL(page.url()).pathname.split("/").pop()!;
    await expect(page.locator("main")).not.toContainText(id);

    // deleting it says the contact stays
    const dialog = page.getByRole("dialog");
    await expect(async () => {
      await page.getByRole("button", { name: "Delete" }).click();
      await expect(dialog).toBeVisible({ timeout: 1_000 });
    }).toPass(COLD);
    await expect(dialog).toContainText(`Delete ${company}? This can't be undone.`);
    await expect(dialog).toContainText("Its 1 contact stays, with no company.");
    await dialog.getByRole("button", { name: "Delete" }).click();
    await expect(page).toHaveURL(/\/companies$/, COLD);

    // the contact is still there, with no company
    await page.goto("/contacts");
    await page.getByRole("link", { name: person, exact: true }).click();
    await expect(page.getByRole("heading", { name: person, level: 1 })).toBeVisible(COLD);
    await expect(page.getByText("No company", { exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: company })).toHaveCount(0);
  });

  test("a company's page starts a new contact in that company, and No company takes it out", async ({ page }) => {
    test.slow();
    const stamp = Date.now();
    const company = `Paston Wool ${stamp}`;
    const person = `Agnes Paston ${stamp}`;
    await addCompany(page, company);
    await expect(page.getByText("No contacts here yet.")).toBeVisible();

    await page.getByRole("link", { name: "Add contact" }).click();
    await expect(page.getByRole("heading", { name: "Add contact", level: 1 })).toBeVisible(COLD);
    await expect(page.getByRole("combobox", { name: "Company" })).toHaveValue(company);
    await page.getByLabel("Name").fill(person);
    await page.getByRole("button", { name: "Add contact" }).click();
    await expect(page.getByRole("link", { name: company })).toBeVisible(COLD);

    await page.getByRole("link", { name: "Edit" }).click();
    await expect(page.getByRole("heading", { name: `Edit ${person}`, level: 1 })).toBeVisible(COLD);
    await pickCompany(page, "No company", "No company");
    await expect(page.getByRole("combobox", { name: "Company" })).toHaveValue("");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("No company", { exact: true })).toBeVisible(COLD);
  });
});
