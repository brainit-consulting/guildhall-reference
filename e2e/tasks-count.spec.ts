import { expect, test, type Page } from "@playwright/test";
import { OWNER_STATE } from "./owner";

// The dev server compiles each page on its first visit; every wait for a newly opened page uses this.
const COLD = { timeout: 30_000 };

const heading = (page: Page) => page.getByRole("heading", { level: 1 });
const openBoxes = (page: Page) => page.getByRole("table", { name: "Tasks" }).getByRole("checkbox", { checked: false });

test.describe("as the owner", () => {
  test.use({ storageState: OWNER_STATE, viewport: { width: 1280, height: 800 } });

  test("the heading counts the open tasks, drops one when ticked, and is just Tasks when none are open", async ({ page }) => {
    const deal = `Hang the vestry door ${Date.now()}`;
    await page.goto("/deals/new");
    await page.getByLabel("Title").fill(deal);
    await page.getByRole("button", { name: "Add deal" }).click();
    await expect(page.getByRole("heading", { name: deal, level: 1 })).toBeVisible(COLD);
    const dealPath = new URL(page.url()).pathname;
    for (const title of ["Measure the frame", "Send the door quote"]) {
      await page.getByLabel("Title").fill(`${title} ${Date.now()}`);
      await page.getByLabel("Due date").fill("2026-10-20");
      await page.getByRole("button", { name: "Add task" }).click();
      await expect(page.getByRole("list", { name: "Open tasks" }).getByText(title)).toBeVisible(COLD);
    }

    // the figure is the number of open tasks the list shows
    await page.goto("/tasks");
    await expect(openBoxes(page).first()).toBeVisible(COLD);
    const open = await openBoxes(page).count();
    expect(open).toBeGreaterThanOrEqual(2);
    await expect(heading(page)).toHaveText(`Tasks ${open}`);
    await expect(heading(page).locator("span")).toHaveClass(/text-muted/);

    // ticking one off takes it off the figure
    await openBoxes(page).first().check();
    await expect(heading(page)).toHaveText(`Tasks ${open - 1}`, COLD);

    // a filter narrows the list, not the figure
    await page.goto("/tasks?due=today");
    await expect(heading(page)).toHaveText(`Tasks ${open - 1}`, COLD);

    // with nothing open, the heading is just "Tasks"
    await page.goto("/tasks");
    for (let n = open - 1; n > 0; n--) {
      await openBoxes(page).first().check();
      await expect(heading(page)).toHaveText(n > 1 ? `Tasks ${n - 1}` : "Tasks", COLD);
    }
    await expect(page.getByText("No open tasks.")).toBeVisible();

    // so other tests' open deal totals stay as they were
    await page.goto(dealPath);
    await expect(async () => {
      await page.getByRole("button", { name: "Delete" }).click();
      await expect(page.getByRole("dialog")).toBeVisible({ timeout: 1_000 });
    }).toPass(COLD);
    await page.getByRole("dialog").getByRole("button", { name: "Delete" }).click();
    await expect(page).toHaveURL(/\/deals$/, COLD);
  });
});
