import { expect, test, type Page } from "@playwright/test";
import { OWNER_STATE } from "./owner";

// The dev server compiles each page on its first visit; every wait for a newly opened page uses this.
const COLD = { timeout: 30_000 };

const column = (page: Page, stage: string) => page.getByRole("region", { name: stage, exact: true });
const card = (page: Page, stage: string, title: string) =>
  column(page, stage).getByRole("listitem").filter({ has: page.getByRole("link", { name: title, exact: true }) });

// Tests share one database, so a column's figures are read before and after rather than expected outright. Amounts
// are compared in cents, as whole numbers, never as floats.
async function figures(page: Page, stage: string): Promise<{ count: number; cents: bigint }> {
  const spans = column(page, stage).locator("p").first().locator("span");
  await expect(spans.first()).toBeVisible(COLD);
  const count = Number((await spans.nth(0).textContent())!.replace(/ deals?$/, ""));
  const money = (await spans.nth(1).textContent())!; // "$1,250.50"
  expect(money).toMatch(/^\$[\d,]+\.\d{2}$/);
  return { count, cents: BigInt(money.replace(/[^\d]/g, "")) };
}

async function addDeal(page: Page, title: string, value: string) {
  await page.goto("/deals/new");
  await page.getByLabel("Title").fill(title);
  await page.getByLabel("Value (USD)").fill(value);
  await page.getByRole("button", { name: "Add deal" }).click();
  await expect(page.getByRole("heading", { name: title, level: 1 })).toBeVisible(COLD);
}

// The menu works once the board has hydrated; a click before then is tried again.
async function moveWithMenu(page: Page, from: string, title: string, to: string) {
  const c = card(page, from, title);
  await expect(async () => {
    await c.getByRole("button", { name: "Move to…" }).click();
    await expect(page.getByRole("menu")).toBeVisible({ timeout: 1_000 });
  }).toPass(COLD);
  await page.getByRole("menuitem", { name: `Move to ${to}` }).click();
}

test.describe("as the owner", () => {
  test.use({ storageState: OWNER_STATE });

  test("moving a deal with Move to… changes its stage and both columns' figures", async ({ page }) => {
    test.slow(); // several pages compile on first visit
    const stamp = Date.now();
    const title = `Glaze the guild windows ${stamp}`;
    const company = `Lynn Glaziers ${stamp}`;

    await page.goto("/companies/new");
    await page.getByLabel("Name").fill(company);
    await page.getByRole("button", { name: "Add company" }).click();
    await expect(page.getByRole("heading", { name: company, level: 1 })).toBeVisible(COLD);

    await page.goto("/pipeline");
    await expect(page.getByRole("heading", { name: "Pipeline", level: 1 })).toBeVisible(COLD);
    const newBefore = await figures(page, "New");
    const wonBefore = await figures(page, "Won");

    await page.goto("/deals/new");
    await page.getByLabel("Title").fill(title);
    await page.getByLabel("Value (USD)").fill("1,234.56");
    const companyBox = page.getByRole("combobox", { name: "Company" });
    await expect(async () => {
      await companyBox.fill("");
      await companyBox.fill(`glaziers ${stamp}`);
      await expect(page.getByRole("option", { name: company })).toBeVisible({ timeout: 1_000 });
    }).toPass(COLD);
    await page.getByRole("option", { name: company }).click();
    await page.getByRole("button", { name: "Add deal" }).click();
    await expect(page.getByRole("heading", { name: title, level: 1 })).toBeVisible(COLD);

    // through the menu; five columns in stage order
    await page.getByRole("navigation", { name: "Main" }).getByRole("link", { name: "Pipeline" }).click();
    await expect(page).toHaveURL(/\/pipeline$/, COLD);
    await expect(page.getByRole("region", { name: "Pipeline board" }).getByRole("heading", { level: 2 }))
      .toHaveText(["New", "Contacted", "Proposal", "Won", "Lost"], COLD);

    // the card: title, company, value; no database ids anywhere on the page
    const fresh = card(page, "New", title);
    await expect(fresh).toContainText(company, COLD);
    await expect(fresh).toContainText("$1,234.56");
    expect(await figures(page, "New")).toEqual({ count: newBefore.count + 1, cents: newBefore.cents + 123_456n });

    await moveWithMenu(page, "New", title, "Won");
    await expect(card(page, "Won", title)).toBeVisible();
    await expect(card(page, "New", title)).toHaveCount(0);
    expect(await figures(page, "New")).toEqual(newBefore);
    expect(await figures(page, "Won")).toEqual({ count: wonBefore.count + 1, cents: wonBefore.cents + 123_456n });

    // saved, not only shown
    await page.reload();
    await expect(card(page, "Won", title)).toBeVisible(COLD);
    expect(await figures(page, "Won")).toEqual({ count: wonBefore.count + 1, cents: wonBefore.cents + 123_456n });

    // a click on the card opens the deal, which says Won
    await card(page, "Won", title).getByRole("link", { name: title }).click();
    await expect(page.getByRole("heading", { name: title, level: 1 })).toBeVisible(COLD);
    await expect(page.getByText("Won", { exact: true })).toBeVisible();
    const id = new URL(page.url()).pathname.split("/").pop()!;
    await page.goto("/pipeline");
    await expect(card(page, "Won", title)).toBeVisible(COLD);
    await expect(page.locator("main")).not.toContainText(id);
    expect(await page.locator("main").innerHTML()).not.toContain(`"${id}"`); // nor in announcements and labels
  });

  test("the Move to… menu offers the other four stages and closes with Escape", async ({ page }) => {
    const title = `Mend the bell rope ${Date.now()}`;
    await addDeal(page, title, "40");
    await page.goto("/pipeline");
    const c = card(page, "New", title);
    await expect(async () => {
      await c.getByRole("button", { name: "Move to…" }).click();
      await expect(page.getByRole("menu")).toBeVisible({ timeout: 1_000 });
    }).toPass(COLD);
    await expect(page.getByRole("menuitem")).toHaveText(["Move to Contacted", "Move to Proposal", "Move to Won", "Move to Lost"]);
    await expect(page.getByRole("menuitem", { name: "Move to Contacted" })).toBeFocused();
    await page.keyboard.press("ArrowDown");
    await expect(page.getByRole("menuitem", { name: "Move to Proposal" })).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("menu")).toHaveCount(0);
    await expect(c.getByRole("button", { name: "Move to…" })).toBeFocused();

    // and by keyboard alone
    await page.keyboard.press("Enter");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("Enter");
    await expect(card(page, "Proposal", title)).toBeVisible();
  });

  test("a move is written on the deal's timeline", async ({ page }) => {
    const title = `Lime-wash the barn ${Date.now()}`;
    await addDeal(page, title, "30");
    await expect(page.getByText("Nothing logged yet", { exact: true })).toBeVisible(); // last activity, before
    await page.goto("/pipeline");
    await moveWithMenu(page, "New", title, "Contacted");
    await expect(card(page, "Contacted", title)).toBeVisible();

    await card(page, "Contacted", title).getByRole("link", { name: title }).click();
    await expect(page.getByRole("heading", { name: title, level: 1 })).toBeVisible(COLD);
    const entry = page.getByRole("list", { name: "Timeline" }).getByRole("listitem");
    await expect(entry).toHaveCount(1);
    await expect(entry).toContainText("Stage change");
    await expect(entry).toContainText("Moved from New to Contacted");
    await expect(page.getByText("today", { exact: true })).toBeVisible(); // the move is activity
  });

  test("dragging a card to another column moves the deal", async ({ page }) => {
    const title = `Sweep the hall chimney ${Date.now()}`;
    await addDeal(page, title, "75.25");
    await page.goto("/pipeline");
    await expect(card(page, "New", title)).toBeVisible(COLD);
    const before = await figures(page, "Contacted");

    // a real mouse drag, in steps, as dnd-kit waits for 5px of movement
    const from = (await card(page, "New", title).boundingBox())!;
    const to = (await column(page, "Contacted").boundingBox())!;
    await expect(async () => {
      await page.mouse.move(from.x + from.width / 2, from.y + from.height - 8);
      await page.mouse.down();
      await page.mouse.move(from.x + from.width / 2 + 20, from.y + from.height - 8, { steps: 5 });
      await page.mouse.move(to.x + to.width / 2, to.y + 120, { steps: 10 });
      await page.mouse.up();
      await expect(card(page, "Contacted", title)).toBeVisible({ timeout: 2_000 });
    }).toPass(COLD);
    expect(await figures(page, "Contacted")).toEqual({ count: before.count + 1, cents: before.cents + 7_525n });

    await page.reload();
    await expect(card(page, "Contacted", title)).toBeVisible(COLD);
  });
});

test.describe("at phone width", () => {
  test.use({ storageState: OWNER_STATE, viewport: { width: 390, height: 844 } });

  test("the board scrolls sideways inside itself, the page doesn't, and Move to… works", async ({ page }) => {
    const title = `Tar the boat shed ${Date.now()}`;
    await addDeal(page, title, "12");
    await page.goto("/pipeline");
    const board = page.getByRole("region", { name: "Pipeline board" });
    await expect(card(page, "New", title)).toBeVisible(COLD);

    const pageFits = await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);
    expect(pageFits).toBe(true);
    expect(await board.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(true);

    await moveWithMenu(page, "New", title, "Lost");
    await expect(card(page, "Lost", title)).toBeVisible();
  });
});

test("Pipeline needs you signed in", async ({ page }) => {
  await page.goto("/pipeline");
  await expect(page).toHaveURL(/\/signin$/);
});
