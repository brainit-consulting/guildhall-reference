import { expect, test, type Page } from "@playwright/test";
import { TIME_ZONE, todayIn } from "../src/lib/dates";
import { OWNER_STATE } from "./owner";

// The dev server compiles each page on its first visit; every wait for a newly opened page uses this.
const COLD = { timeout: 30_000 };

// Every task this spec adds starts with this, so a retry can tick off what a failed attempt left behind.
const MINE = "Due spec";

// The business's today, as Home works it out, so this passes on the UTC runner and late at night locally.
const today = todayIn(TIME_ZONE, new Date());
const shift = (day: string, days: number) => new Date(Date.parse(`${day}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);

const table = (page: Page) => page.getByRole("table", { name: "Tasks" });
const mine = (page: Page) => table(page).getByRole("row").filter({ hasText: MINE });
const heading = (page: Page) => page.getByRole("heading", { level: 2, name: /^(Open|Open and done|Overdue|Due today)$/ });
const dueSelect = (page: Page) => page.getByRole("combobox", { name: "Due", exact: true });

async function addTask(page: Page, title: string, dueOn: string) {
  await page.getByLabel("Title").fill(title);
  await page.getByLabel("Due date").fill(dueOn);
  await page.getByRole("button", { name: "Add task" }).click();
  await expect(page.getByRole("list", { name: "Open tasks" }).getByText(title, { exact: true })).toBeVisible(COLD);
}

async function tickMine(page: Page) {
  const boxes = page.getByRole("checkbox", { name: new RegExp(`^Done: ${MINE} `) });
  for (let n = await boxes.count(); n > 0; n--) {
    await boxes.first().check();
    await expect(boxes).toHaveCount(n - 1, COLD);
  }
}

test.describe("as the owner", () => {
  test.use({ storageState: OWNER_STATE, viewport: { width: 1280, height: 800 } });

  test("Due shows only what's overdue or due today, and a reload keeps it", async ({ page }) => {
    await page.goto("/tasks");
    await expect(table(page).or(page.getByText("No open tasks."))).toBeVisible(COLD);
    await tickMine(page);

    const stamp = Date.now();
    const deal = `Lime-wash the barn ${stamp}`;
    const late = `${MINE} send the quote ${stamp}`;
    const now = `${MINE} call back ${stamp}`;
    const soon = `${MINE} book the visit ${stamp}`;
    await page.goto("/deals/new");
    await page.getByLabel("Title").fill(deal);
    await page.getByRole("button", { name: "Add deal" }).click();
    await expect(page.getByRole("heading", { name: deal, level: 1 })).toBeVisible(COLD);
    const dealUrl = page.url();
    await addTask(page, late, shift(today, -1));
    await addTask(page, now, today);
    await addTask(page, soon, shift(today, 1));

    await page.goto("/tasks");
    await expect(mine(page)).toHaveCount(3, COLD);
    await expect(dueSelect(page)).toHaveValue("");

    // picking Due today shows it at once and puts it in the address
    await expect(async () => {
      await dueSelect(page).selectOption({ label: "Due today" });
      await expect(page).toHaveURL(/\/tasks\?due=today$/, { timeout: 2_000 });
    }).toPass(COLD);
    await expect(heading(page)).toHaveText("Due today", COLD);
    await expect(mine(page)).toHaveCount(1);
    await expect(mine(page)).toContainText(now);
    await expect(page.getByRole("switch", { name: "Show done" })).toHaveCount(0);

    await page.reload();
    await expect(heading(page)).toHaveText("Due today", COLD);
    await expect(dueSelect(page)).toHaveValue("today");
    await expect(mine(page)).toHaveCount(1);
    await expect(mine(page)).toContainText(now);

    await dueSelect(page).selectOption({ label: "Overdue" });
    await expect(page).toHaveURL(/\/tasks\?due=overdue$/, COLD);
    await expect(heading(page)).toHaveText("Overdue", COLD);
    await expect(mine(page)).toHaveCount(1);
    await expect(mine(page)).toContainText(late);

    // an unknown value is ignored
    await page.goto("/tasks?due=junk");
    await expect(heading(page)).toHaveText("Open", COLD);
    await expect(dueSelect(page)).toHaveValue("");
    await expect(mine(page)).toHaveCount(3);

    await tickMine(page);

    // so other tests' open deal totals stay as they were
    await page.goto(dealUrl);
    await expect(async () => {
      await page.getByRole("button", { name: "Delete" }).click();
      await expect(page.getByRole("dialog")).toBeVisible({ timeout: 1_000 });
    }).toPass(COLD);
    await page.getByRole("dialog").getByRole("button", { name: "Delete" }).click();
    await expect(page).toHaveURL(/\/deals$/, COLD);
  });
});
