import { expect, test, type Page } from "@playwright/test";
import { formatDay, TIME_ZONE, todayIn } from "../src/lib/dates";
import { OWNER_STATE } from "./owner";

// The dev server compiles each page on its first visit; every wait for a newly opened page uses this.
const COLD = { timeout: 30_000 };

// Every task this spec adds starts with this, so a retry can tick off what a failed attempt left behind.
const MINE = "Home spec";

// The business's today, as Home works it out, so this passes on the UTC runner and late at night locally.
const today = todayIn(TIME_ZONE, new Date());
const shift = (day: string, days: number) => new Date(Date.parse(`${day}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);

const section = (page: Page, name: string) => page.getByRole("region", { name });

async function addDeal(page: Page, title: string) {
  await page.goto("/deals/new");
  await page.getByLabel("Title").fill(title);
  await page.getByRole("button", { name: "Add deal" }).click();
  await expect(page.getByRole("heading", { name: title, level: 1 })).toBeVisible(COLD);
}

// Adds a task once on the record page open now: saving isn't safe to retry.
async function addTask(page: Page, title: string, dueOn: string) {
  await page.getByLabel("Title").fill(title);
  await page.getByLabel("Due date").fill(dueOn);
  await page.getByRole("button", { name: "Add task" }).click();
  await expect(page.getByRole("list", { name: "Open tasks" }).getByText(title, { exact: true })).toBeVisible(COLD);
}

// Ticks a task off on Home and waits for its line to go. check() waits for the box to hydrate.
async function tick(page: Page, title: string) {
  const box = page.getByRole("checkbox", { name: `Done: ${title}`, exact: true });
  await box.check();
  await expect(box).toHaveCount(0, COLD);
}

async function tickLeftovers(page: Page) {
  const boxes = page.getByRole("checkbox", { name: new RegExp(`^Done: ${MINE} `) });
  for (let n = await boxes.count(); n > 0; n--) {
    await boxes.first().check();
    await expect(boxes).toHaveCount(n - 1, COLD);
  }
}

async function deleteDeal(page: Page) {
  await expect(async () => {
    await page.getByRole("button", { name: "Delete" }).click();
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 1_000 });
  }).toPass(COLD);
  await page.getByRole("dialog").getByRole("button", { name: "Delete" }).click();
  await expect(page).toHaveURL(/\/deals$/, COLD);
}

test.describe("as the owner", () => {
  test.use({ storageState: OWNER_STATE });

  test("Home shows what's overdue and what's due today, and ticking a task removes it", async ({ page }) => {
    await page.goto("/home");
    await expect(page.getByRole("heading", { name: /^Welcome, / })).toBeVisible(COLD);
    await tickLeftovers(page);

    const stamp = Date.now();
    const deal = `Re-point the chimney ${stamp}`;
    const late = `${MINE} send the quote ${stamp}`;
    const now = `${MINE} call back ${stamp}`;
    const soon = `${MINE} book the visit ${stamp}`;
    await addDeal(page, deal);
    await addTask(page, soon, shift(today, 1));
    await addTask(page, now, today);
    await addTask(page, late, shift(today, -1));

    await page.goto("/home");
    const overdue = section(page, "Overdue");
    const dueToday = section(page, "Due today");
    await expect(overdue.getByRole("listitem").filter({ hasText: late })).toContainText(formatDay(shift(today, -1)), COLD);
    await expect(dueToday.getByRole("listitem").filter({ hasText: now })).toBeVisible();
    await expect(overdue).not.toContainText(now);
    await expect(dueToday).not.toContainText(late);
    await expect(page.locator("main")).not.toContainText(soon);

    // what it belongs to links to it, and no database ids show
    const link = dueToday.getByRole("listitem").filter({ hasText: now }).getByRole("link", { name: deal });
    const href = await link.getAttribute("href");
    expect(href).toMatch(/^\/deals\/[0-9a-f-]{36}$/);
    await expect(page.locator("main")).not.toContainText(href!.split("/").pop()!);

    // ticking removes the line, and a reload doesn't bring it back
    await tick(page, late);
    await page.reload();
    await expect(page.getByRole("heading", { name: "Due today" })).toBeVisible(COLD);
    await expect(page.locator("main")).not.toContainText(late);

    // with nothing overdue or due today, Home says so
    await tick(page, now);
    await expect(page.getByText("Nothing due today.")).toBeVisible(COLD);
    await expect(page.getByRole("heading", { name: "Overdue" })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "Due today" })).toHaveCount(0);

    await page.goto(href!);
    await expect(page.getByRole("heading", { name: deal, level: 1 })).toBeVisible(COLD);
    await deleteDeal(page); // so other tests' open totals stay as they were
  });
});

test.describe("at phone width", () => {
  test.use({ storageState: OWNER_STATE, viewport: { width: 390, height: 844 } });

  test("Home's task lines fit", async ({ page }) => {
    const deal = `Re-glaze the hall ${Date.now()}`;
    const title = `${MINE} a very long promise without spaces ${"x".repeat(200)}`;
    await addDeal(page, deal);
    const dealUrl = page.url();
    await addTask(page, title, today);
    await page.goto("/home");
    await expect(section(page, "Due today").getByText(title)).toBeVisible(COLD);
    const fits = await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);
    expect(fits).toBe(true);
    await tick(page, title);
    await page.goto(dealUrl);
    await deleteDeal(page);
  });
});
