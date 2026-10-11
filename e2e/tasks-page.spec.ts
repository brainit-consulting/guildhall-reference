import { expect, test, type Page } from "@playwright/test";
import { OWNER_STATE } from "./owner";

// The dev server compiles each page on its first visit; every wait for a newly opened page uses this.
const COLD = { timeout: 30_000 };

const menu = (page: Page) => page.getByRole("navigation", { name: "Main" });
const table = (page: Page) => page.getByRole("table", { name: "Tasks" });
const row = (page: Page, title: string) => table(page).getByRole("row").filter({ hasText: title });
const box = (page: Page, title: string) => page.getByRole("checkbox", { name: `Done: ${title}` });
const showDone = (page: Page) => page.getByRole("switch", { name: "Show done" });

// Picks a record in the form's combobox. The list only opens once the page has hydrated, so the pick is retried.
async function pick(page: Page, name: string) {
  const picker = page.getByRole("combobox", { name: "Contact, company or deal" });
  await expect(async () => {
    await picker.fill(name);
    await expect(page.getByRole("option", { name: new RegExp(`^${name}`) })).toBeVisible({ timeout: 1_000 });
  }).toPass(COLD);
  await page.getByRole("option", { name: new RegExp(`^${name}`) }).click();
  await expect(picker).toHaveValue(name);
}

async function addRecord(page: Page, kind: "deals" | "companies", field: string, name: string, button: string) {
  await page.goto(`/${kind}/new`);
  await page.getByLabel(field).fill(name);
  await page.getByRole("button", { name: button }).click();
  await expect(page.getByRole("heading", { name, level: 1 })).toBeVisible(COLD);
  return new URL(page.url()).pathname;
}

test.describe("as the owner", () => {
  test.use({ storageState: OWNER_STATE, viewport: { width: 1280, height: 800 } });

  test("a task added on a deal is on /tasks, links back, and ticks off there", async ({ page }) => {
    const deal = `Glaze the chapel ${Date.now()}`;
    const dealPath = await addRecord(page, "deals", "Title", deal, "Add deal");
    const title = `Send the glazing quote ${Date.now()}`;
    await page.getByLabel("Title").fill(title);
    await page.getByLabel("Due date").fill("2026-10-12");
    await page.getByRole("button", { name: "Add task" }).click();
    await expect(page.getByRole("list", { name: "Open tasks" }).getByText(title)).toBeVisible(COLD);

    await page.goto("/tasks");
    await expect(row(page, title)).toContainText("12 Oct 2026", COLD);
    await expect(row(page, title)).toContainText(`Deal ${deal}`);
    await expect(page.locator("main")).not.toContainText(dealPath.split("/").pop()!);

    // the link goes to the deal
    await row(page, title).getByRole("link", { name: deal }).click();
    await expect(page).toHaveURL(new RegExp(`${dealPath}$`), COLD);
    await page.goBack();

    await box(page, title).check();
    await expect(row(page, title)).toHaveCount(0, COLD);
    await page.goto(dealPath);
    await expect(page.getByText("No open tasks. Add one below.")).toBeVisible(COLD);

    // so other tests' open deal totals stay as they were
    await expect(async () => {
      await page.getByRole("button", { name: "Delete" }).click();
      await expect(page.getByRole("dialog")).toBeVisible({ timeout: 1_000 });
    }).toPass(COLD);
    await page.getByRole("dialog").getByRole("button", { name: "Delete" }).click();
    await expect(page).toHaveURL(/\/deals$/, COLD);
  });

  test("adding a task for a picked company, ticking it, and finding it under Show done", async ({ page }) => {
    const company = `Kings Lynn Glaziers ${Date.now()}`;
    const companyPath = await addRecord(page, "companies", "Name", company, "Add company");
    const title = `Book a visit to the yard ${Date.now()}`;

    await page.goto("/tasks");
    await expect(menu(page).getByRole("link", { name: "Tasks" })).toHaveAttribute("aria-current", "page", COLD);
    await expect(showDone(page)).toHaveAttribute("aria-checked", "false");

    // nothing picked is explained, and what was typed is kept
    await page.getByLabel("Title").fill(title);
    await page.getByLabel("Due date").fill("2026-10-15");
    await page.getByRole("button", { name: "Add task" }).click();
    await expect(page.getByText("Pick the contact, company or deal this is for.")).toBeVisible(COLD);
    await expect(page.getByLabel("Title")).toHaveValue(title);

    await pick(page, company);
    await page.getByRole("button", { name: "Add task" }).click();
    await expect(row(page, title)).toContainText(`Company ${company}`, COLD);
    await expect(page.getByLabel("Title")).toHaveValue("");

    await page.goto(companyPath);
    await expect(page.getByRole("list", { name: "Open tasks" }).getByText(title)).toBeVisible(COLD);

    await page.goto("/tasks");
    await box(page, title).check();
    await expect(row(page, title)).toHaveCount(0, COLD);

    // Show done from the keyboard: it lands in the address and survives a reload
    await showDone(page).focus();
    await page.keyboard.press("Space");
    await expect(page).toHaveURL(/\/tasks\?done=show$/, COLD);
    await expect(showDone(page)).toHaveAttribute("aria-checked", "true");
    await expect(box(page, title)).toBeChecked();
    await page.reload();
    await expect(showDone(page)).toHaveAttribute("aria-checked", "true", COLD);
    await expect(box(page, title)).toBeChecked();

    // unticking reopens it: still listed with Show done on, and back among the open ones with it off
    await box(page, title).uncheck();
    await page.reload();
    await expect(box(page, title)).not.toBeChecked(COLD);
    await showDone(page).click();
    await expect(page).toHaveURL(/\/tasks$/, COLD);
    await expect(showDone(page)).toHaveAttribute("aria-checked", "false");
    await expect(box(page, title)).not.toBeChecked();

    await box(page, title).check(); // so later runs' lists stay short
    await expect(row(page, title)).toHaveCount(0, COLD);
  });
});

test.describe("at phone width", () => {
  test.use({ storageState: OWNER_STATE, viewport: { width: 390, height: 844 } });

  test("the page fits, tasks stack, and Tasks is current in the top bar", async ({ page }) => {
    const company = `Walsoken Thatchers ${Date.now()}`;
    await addRecord(page, "companies", "Name", company, "Add company");
    await page.goto("/tasks");
    const title = `A very long promise without spaces ${"x".repeat(200)}`;
    await page.getByLabel("Title").fill(title);
    await page.getByLabel("Due date").fill("2026-10-12");
    await pick(page, company);
    await page.getByRole("button", { name: "Add task" }).click();

    const item = page.getByRole("list", { name: "Tasks" }).getByRole("listitem").filter({ hasText: title });
    await expect(item).toContainText(`Company: ${company}`, COLD);
    await expect(table(page)).toBeHidden();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);

    await page.getByRole("button", { name: "Menu" }).click();
    await expect(menu(page).getByRole("link", { name: "Tasks" })).toHaveAttribute("aria-current", "page");
    await page.getByRole("button", { name: "Menu" }).click();

    await box(page, title).check();
    await expect(item).toHaveCount(0, COLD);
  });
});
