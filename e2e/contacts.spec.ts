import { expect, test, type Page } from "@playwright/test";
import { OWNER_STATE } from "./owner";

const menu = (page: Page) => page.getByRole("navigation", { name: "Main" });

// The dev server compiles each contact page on its first visit, which can take longer than expect's 5s while other
// workers keep it busy; every wait for a newly opened page uses this.
const COLD = { timeout: 30_000 };

test.describe("as the owner", () => {
  test.use({ storageState: OWNER_STATE });

  test("adding, editing and deleting a contact", async ({ page }) => {
    test.slow(); // four contact pages compile on first visit; COLD bounds each wait, this the whole test
    // tests share one database, so each names its contact uniquely
    const name = `Wat Tyler ${Date.now()}`;
    await page.goto("/home");
    await menu(page).getByRole("link", { name: "Contacts" }).click();
    await expect(page).toHaveURL(/\/contacts$/, COLD);
    await expect(page.getByRole("heading", { name: "Contacts", level: 1 })).toBeVisible(COLD);

    await page.getByRole("link", { name: "Add contact" }).click();
    await expect(page.getByRole("heading", { name: "Add contact", level: 1 })).toBeVisible(COLD);
    await page.getByLabel("Name").fill(name);
    await page.getByLabel("Email").fill("wat@lynn.example");
    await page.getByLabel("Phone").fill("01553 774 100");
    await page.getByLabel("Job title").fill("Master tiler");
    await page.getByLabel("Notes").fill("Roofs for the guildhall.");
    await page.getByRole("button", { name: "Add contact" }).click();

    // the contact's own page, with every field
    await expect(page.getByRole("heading", { name, level: 1 })).toBeVisible(COLD);
    for (const value of ["wat@lynn.example", "01553 774 100", "Master tiler", "Roofs for the guildhall."]) {
      await expect(page.getByText(value, { exact: true })).toBeVisible();
    }
    // no database ids on the page, only in the address
    const id = new URL(page.url()).pathname.split("/").pop()!;
    await expect(page.locator("main")).not.toContainText(id);

    // it heads the table
    await page.getByRole("link", { name: "Contacts", exact: true }).first().click();
    await expect(page.getByRole("heading", { name: "Contacts", level: 1 })).toBeVisible(COLD);
    const firstRow = page.getByRole("row").nth(1);
    await expect(firstRow).toContainText(name);
    await expect(firstRow).toContainText("wat@lynn.example");
    await expect(firstRow).toContainText("01553 774 100");
    await expect(firstRow).toContainText("Master tiler");

    await page.getByRole("link", { name, exact: true }).click();
    await expect(page.getByRole("heading", { name, level: 1 })).toBeVisible(COLD);
    await page.getByRole("link", { name: "Edit" }).click();
    await expect(page.getByRole("heading", { name: `Edit ${name}`, level: 1 })).toBeVisible(COLD);
    await expect(page.getByLabel("Job title")).toHaveValue("Master tiler");
    await page.getByLabel("Job title").fill("Mason");
    await page.getByLabel("Phone").fill("");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByRole("heading", { name, level: 1 })).toBeVisible(COLD);
    await expect(page.getByText("Mason", { exact: true })).toBeVisible();
    await expect(page.getByText("01553 774 100")).toHaveCount(0);

    // Delete asks first; Cancel keeps the contact. The button opens the dialog only once the page has hydrated, so
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
    await expect(page).toHaveURL(/\/contacts$/, COLD);
    await expect(page.getByRole("heading", { name: "Contacts", level: 1 })).toBeVisible(COLD);
    await expect(page.getByRole("link", { name, exact: true })).toHaveCount(0);
  });

  test("a missing name or a malformed email is explained and what was typed stays", async ({ page }) => {
    await page.goto("/contacts/new");
    await page.getByLabel("Email").fill("wat-at-lynn");
    await page.getByLabel("Job title").fill("Tiler");
    await page.getByRole("button", { name: "Add contact" }).click();
    await expect(page.getByText("Enter a name.")).toBeVisible(COLD);
    await expect(page.getByText("That doesn't look like an email address. Check it and try again.")).toBeVisible();
    await expect(page.getByLabel("Email")).toHaveValue("wat-at-lynn");
    await expect(page.getByLabel("Job title")).toHaveValue("Tiler");
    await expect(page).toHaveURL(/\/contacts\/new$/);
  });

  test("a contact that isn't there is not found", async ({ page }) => {
    const res = await page.goto("/contacts/00000000-0000-4000-8000-000000000000");
    expect(res?.status()).toBe(404);
  });
});

test.describe("at phone width", () => {
  test.use({ storageState: OWNER_STATE, viewport: { width: 390, height: 844 } });

  test("the table fits without scrolling sideways, even with a long email", async ({ page }) => {
    const name = `Julian of Norwich ${Date.now()}`;
    await page.goto("/contacts/new");
    await page.getByLabel("Name").fill(name);
    await page.getByLabel("Email").fill("julian.anchoress.saint.julians.church@conisford-norwich.example");
    await page.getByLabel("Phone").fill("01603 767 380");
    await page.getByRole("button", { name: "Add contact" }).click();
    await expect(page.getByRole("heading", { name, level: 1 })).toBeVisible(COLD);

    await page.goto("/contacts");
    const table = page.getByRole("table");
    await expect(table.getByRole("link", { name, exact: true })).toBeVisible(COLD);
    // Phone and Job title are left to the contact's page
    await expect(table.getByRole("columnheader", { name: "Phone" })).toBeHidden();
    await expect(table.getByRole("columnheader", { name: "Job title" })).toBeHidden();
    const fits = await table.evaluate((t) => {
      const box = t.parentElement!;
      const html = document.documentElement;
      return box.scrollWidth <= box.clientWidth && html.scrollWidth <= html.clientWidth;
    });
    expect(fits).toBe(true);
  });
});

test("Contacts needs you signed in", async ({ page }) => {
  await page.goto("/contacts");
  await expect(page).toHaveURL(/\/signin$/);
});
