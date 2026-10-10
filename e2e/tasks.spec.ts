import { expect, test, type Page } from "@playwright/test";
import { OWNER_STATE } from "./owner";

// The dev server compiles each page on its first visit; every wait for a newly opened page uses this.
const COLD = { timeout: 30_000 };

const openTasks = (page: Page) => page.getByRole("list", { name: "Open tasks" });

// Adds a task once: saving isn't safe to retry. The form posts without JavaScript too, so it works before hydration.
async function addTask(page: Page, title: string, dueOn: string) {
  await page.getByLabel("Title").fill(title);
  await page.getByLabel("Due date").fill(dueOn);
  await page.getByRole("button", { name: "Add task" }).click();
  await expect(openTasks(page).getByText(title, { exact: true })).toBeVisible(COLD);
}

// Ticks a task off and waits for it to leave the list. The box is disabled until the page has hydrated, and check()
// waits for that.
async function tick(page: Page, title: string) {
  const box = page.getByRole("checkbox", { name: `Done: ${title}` });
  await box.check();
  await expect(box).toHaveCount(0, COLD);
}

async function deleteRecord(page: Page, back: RegExp) {
  await expect(async () => {
    await page.getByRole("button", { name: "Delete" }).click();
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 1_000 });
  }).toPass(COLD);
  await page.getByRole("dialog").getByRole("button", { name: "Delete" }).click();
  await expect(page).toHaveURL(back, COLD);
}

test.describe("as the owner", () => {
  test.use({ storageState: OWNER_STATE });

  test("a task on a deal is listed by due date, and ticking it off removes it for good", async ({ page }) => {
    const title = `Re-roof the hall ${Date.now()}`;
    await page.goto("/deals/new");
    await page.getByLabel("Title").fill(title);
    await page.getByRole("button", { name: "Add deal" }).click();
    await expect(page.getByRole("heading", { name: title, level: 1 })).toBeVisible(COLD);
    await expect(page.getByText("No open tasks. Add one below.")).toBeVisible();

    await addTask(page, "Send the quote", "2026-10-14");
    await addTask(page, "Book a visit", "2026-10-12");
    // the form is emptied for the next one
    await expect(page.getByLabel("Title")).toHaveValue("");

    const items = openTasks(page).getByRole("listitem");
    await expect(items).toHaveCount(2);
    await expect(items.nth(0)).toContainText("12 Oct 2026");
    await expect(items.nth(0)).toContainText("Book a visit");
    await expect(items.nth(1)).toContainText("14 Oct 2026");
    await expect(items.nth(1)).toContainText("Send the quote");

    // still there after a reload, and no database ids on the page
    await page.reload();
    await expect(openTasks(page).getByRole("listitem")).toHaveCount(2, COLD);
    const id = new URL(page.url()).pathname.split("/").pop()!;
    await expect(page.locator("main")).not.toContainText(id);

    await tick(page, "Send the quote");
    await expect(openTasks(page).getByRole("listitem")).toHaveCount(1, COLD);
    await page.reload();
    await expect(openTasks(page).getByRole("listitem")).toHaveCount(1, COLD);
    await expect(openTasks(page)).not.toContainText("Send the quote");

    // Tab reaches the tick box, Space ticks it
    const box = page.getByRole("checkbox", { name: "Done: Book a visit" });
    await expect(box).toBeEnabled();
    await box.focus();
    await page.keyboard.press("Shift+Tab");
    await page.keyboard.press("Tab");
    await expect(box).toBeFocused();
    await page.keyboard.press("Space");
    await expect(page.getByText("No open tasks. Add one below.")).toBeVisible(COLD);

    await deleteRecord(page, /\/deals$/); // so other tests' open totals stay as they were
  });

  test("a blank title or no due date is explained, and what was typed is kept", async ({ page }) => {
    const person = `Ann Lovell ${Date.now()}`;
    await page.goto("/contacts/new");
    await page.getByLabel("Name").fill(person);
    await page.getByRole("button", { name: "Add contact" }).click();
    await expect(page.getByRole("heading", { name: person, level: 1 })).toBeVisible(COLD);

    await page.getByLabel("Title").fill("Call Ann back");
    await page.getByRole("button", { name: "Add task" }).click();
    await expect(page.getByText("Pick a due date.")).toBeVisible(COLD);
    await expect(page.getByLabel("Title")).toHaveValue("Call Ann back");

    await page.getByLabel("Title").fill("  ");
    await page.getByLabel("Due date").fill("2026-10-12");
    await page.getByRole("button", { name: "Add task" }).click();
    await expect(page.getByText("Write what you promised.")).toBeVisible(COLD);
    await expect(page.getByLabel("Due date")).toHaveValue("2026-10-12");
    await expect(page.getByText("No open tasks. Add one below.")).toBeVisible();

    // and a contact takes tasks like a deal does
    await addTask(page, "Call Ann back", "2026-10-12");
    await tick(page, "Call Ann back");
    await expect(page.getByText("No open tasks. Add one below.")).toBeVisible(COLD);
  });

  test("a company takes tasks too", async ({ page }) => {
    const company = `Lynn Tilers ${Date.now()}`;
    await page.goto("/companies/new");
    await page.getByLabel("Name").fill(company);
    await page.getByRole("button", { name: "Add company" }).click();
    await expect(page.getByRole("heading", { name: company, level: 1 })).toBeVisible(COLD);

    await addTask(page, "Visit the yard", "2026-10-20");
    await page.reload();
    await expect(openTasks(page).getByRole("listitem")).toHaveCount(1, COLD);
    await tick(page, "Visit the yard");
    await expect(page.getByText("No open tasks. Add one below.")).toBeVisible(COLD);
  });
});

test.describe("at phone width", () => {
  test.use({ storageState: OWNER_STATE, viewport: { width: 390, height: 844 } });

  test("the task list fits", async ({ page }) => {
    const person = `Margery Brews ${Date.now()}`;
    await page.goto("/contacts/new");
    await page.getByLabel("Name").fill(person);
    await page.getByRole("button", { name: "Add contact" }).click();
    await expect(page.getByRole("heading", { name: person, level: 1 })).toBeVisible(COLD);
    await addTask(page, `A very long promise without spaces ${"x".repeat(200)}`, "2026-10-12");
    const fits = await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);
    expect(fits).toBe(true);
  });
});
