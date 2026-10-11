import { expect, test, type Page } from "@playwright/test";
import { addDays, formatDay, TIME_ZONE, todayIn } from "../src/lib/dates";
import { OWNER_STATE } from "./owner";

// The dev server compiles each page on its first visit; every wait for a newly opened page uses this.
const COLD = { timeout: 30_000 };

// The business's day, as the app works it out, so this passes on the UTC runner and late at night locally.
const due = formatDay(addDays(todayIn(TIME_ZONE, new Date()), 7));

const card = (page: Page, stage: string, title: string) => page.getByRole("region", { name: stage, exact: true })
  .getByRole("listitem").filter({ has: page.getByRole("link", { name: title, exact: true }) });
const openTasks = (page: Page) => page.getByRole("list", { name: "Open tasks" });

// The menu works once the board has hydrated; a click before then is tried again.
async function move(page: Page, from: string, title: string, to: string) {
  await page.goto("/pipeline");
  const c = card(page, from, title);
  await expect(async () => {
    await c.getByRole("button", { name: "Move to…" }).click();
    await expect(page.getByRole("menu")).toBeVisible({ timeout: 1_000 });
  }).toPass(COLD);
  await page.getByRole("menuitem", { name: `Move to ${to}` }).click();
  await expect(card(page, to, title)).toBeVisible(COLD);
}

test.describe("as the owner", () => {
  test.use({ storageState: OWNER_STATE });

  test("winning a deal adds one follow-up a week later, however often it is won", async ({ page }) => {
    test.slow(); // several pages compile on first visit
    const stamp = Date.now();
    const person = `Ann Lee ${stamp}`;
    const deal = `Kitchen refit ${stamp}`;
    const followUp = `Thank ${person} and ask for a referral`;

    await page.goto("/contacts/new");
    await page.getByLabel("Name").fill(person);
    await page.getByRole("button", { name: "Add contact" }).click();
    await expect(page.getByRole("heading", { name: person, level: 1 })).toBeVisible(COLD);

    await page.goto("/deals/new");
    await page.getByLabel("Title").fill(deal);
    const contactBox = page.getByRole("combobox", { name: "Contact" });
    await expect(async () => {
      await contactBox.fill("");
      await contactBox.fill(person);
      await expect(page.getByRole("option", { name: person })).toBeVisible({ timeout: 1_000 });
    }).toPass(COLD);
    await page.getByRole("option", { name: person }).click();
    await page.getByRole("button", { name: "Add deal" }).click();
    await expect(page.getByRole("heading", { name: deal, level: 1 })).toBeVisible(COLD);
    await expect(page.getByText("No open tasks. Add one below.")).toBeVisible();
    const dealPath = new URL(page.url()).pathname;

    // won on the board: the follow-up is on the deal, due a week after today
    await move(page, "New", deal, "Won");
    await page.goto(dealPath);
    const items = openTasks(page).getByRole("listitem");
    await expect(items).toHaveCount(1, COLD);
    await expect(items.first()).toContainText(followUp);
    await expect(items.first()).toContainText(due);

    // and on /tasks
    await page.goto("/tasks");
    const row = page.getByRole("table", { name: "Tasks" }).getByRole("row").filter({ hasText: followUp });
    await expect(row).toContainText(due, COLD);
    await expect(row).toContainText(`Deal ${deal}`);

    // lost and won again: still the one
    await move(page, "Won", deal, "Lost");
    await move(page, "Lost", deal, "Won");
    await page.goto(dealPath);
    await expect(openTasks(page).getByRole("listitem")).toHaveCount(1, COLD);
    await expect(openTasks(page).getByText(followUp, { exact: true })).toHaveCount(1);

    // ticked done, then lost and won again: no new one
    const box = page.getByRole("checkbox", { name: `Done: ${followUp}` });
    await box.check();
    await expect(page.getByText("No open tasks. Add one below.")).toBeVisible(COLD);
    await move(page, "Won", deal, "Lost");
    await move(page, "Lost", deal, "Won");
    await page.goto(dealPath);
    await expect(page.getByText("No open tasks. Add one below.")).toBeVisible(COLD);

    // so other tests' figures stay as they were
    await expect(async () => {
      await page.getByRole("button", { name: "Delete" }).click();
      await expect(page.getByRole("dialog")).toBeVisible({ timeout: 1_000 });
    }).toPass(COLD);
    await page.getByRole("dialog").getByRole("button", { name: "Delete" }).click();
    await expect(page).toHaveURL(/\/deals$/, COLD);
  });
});
