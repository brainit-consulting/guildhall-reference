import { expect, test, type Page } from "@playwright/test";
import { OWNER_STATE } from "./owner";

// The dev server compiles each page on its first visit; every wait for a newly opened page uses this.
const COLD = { timeout: 30_000 };

const search = (page: Page) => page.getByRole("searchbox", { name: "Search" });
const stage = (page: Page) => page.getByRole("combobox", { name: "Stage" });
const openOnly = (page: Page) => page.getByRole("switch", { name: "Open only" });
const titles = (page: Page) => page.getByRole("table").getByRole("row").locator("td:first-child");
const valueHeading = (page: Page) => page.getByRole("columnheader", { name: "Value" });
const figures = (page: Page) => page.getByLabel("Open deals", { exact: true }).locator("dd");

async function addCompany(page: Page, name: string) {
  await page.goto("/companies/new");
  await page.getByLabel("Name").fill(name);
  await page.getByRole("button", { name: "Add company" }).click();
  await expect(page.getByRole("heading", { name, level: 1 })).toBeVisible(COLD);
}

// The picker works once the page has hydrated; typing before then is tried again.
async function pickCompany(page: Page, name: string) {
  const combobox = page.getByRole("combobox", { name: "Company" });
  await expect(async () => {
    await combobox.fill("");
    await combobox.fill(name);
    await expect(page.getByRole("option", { name })).toBeVisible({ timeout: 1_000 });
  }).toPass(COLD);
  await page.getByRole("option", { name }).click();
}

async function addDeal(page: Page, title: string, value: string, dealStage: string, company?: string) {
  await page.goto("/deals/new");
  await expect(page.getByRole("heading", { name: "Add deal", level: 1 })).toBeVisible(COLD);
  await page.getByLabel("Title").fill(title);
  await page.getByLabel("Value (USD)").fill(value);
  await page.getByLabel("Stage").selectOption(dealStage);
  if (company) await pickCompany(page, company);
  await page.getByRole("button", { name: "Add deal" }).click();
  await expect(page.getByRole("heading", { name: title, level: 1 })).toBeVisible(COLD);
}

// Types into the Search box without pressing Enter. Before the page has hydrated nothing searches as you type, so
// the typing is tried again until the address follows.
async function typeSearch(page: Page, text: string) {
  await expect(async () => {
    await search(page).fill("");
    await search(page).pressSequentially(text, { delay: 60 });
    const q = new URLSearchParams({ q: text }).toString().replace(/[+%]/g, "\\$&");
    await expect(page).toHaveURL(new RegExp(`[?&]${q}(&|$)`), { timeout: 2_000 });
  }).toPass(COLD);
}

// Picks a stage once the page has hydrated; a pick before then is tried again until the address follows.
async function pickStage(page: Page, option: string, url: RegExp) {
  await expect(async () => {
    await stage(page).selectOption(option);
    await expect(page).toHaveURL(url, { timeout: 2_000 });
  }).toPass(COLD);
}

test.describe("as the owner", () => {
  test.use({ storageState: OWNER_STATE, viewport: { width: 1280, height: 800 } });

  test("filtering by stage and open only, sorting by value both ways, and a reload keeps the view", async ({ page }) => {
    test.slow(); // a company and four deals are added through the forms first
    // tests share one database, so this test's deals carry a word nobody else's do
    const tag = `qd${Date.now()}`;
    const company = `Acme Roofing ${tag}`;
    const reroof = `Re-roof ${tag}`;
    const gutters = `Gutters ${tag}`;
    const chimney = `Chimney ${tag}`;
    const porch = `Porch ${tag}`;
    await addCompany(page, company);
    await addDeal(page, reroof, "900", "New", company);
    await addDeal(page, gutters, "1,000", "Proposal");
    await addDeal(page, chimney, "", "Contacted");
    await addDeal(page, porch, "50.25", "Won");

    await page.goto("/deals");
    await expect(page.getByRole("heading", { name: "Deals", level: 1 })).toBeVisible(COLD);
    await typeSearch(page, tag);
    await expect(titles(page)).toHaveText([porch, chimney, gutters, reroof]);

    // one stage, then any stage again
    await pickStage(page, "Proposal", new RegExp(`\\?q=${tag}&stage=Proposal$`));
    await expect(titles(page)).toHaveText([gutters]);
    await expect(figures(page)).toHaveText(["1", "$1,000.00"]);
    await pickStage(page, "", new RegExp(`\\?q=${tag}$`));
    await expect(titles(page)).toHaveText([porch, chimney, gutters, reroof]);

    // open only hides the Won deal, and the open figures count only what is listed
    await openOnly(page).click();
    await expect(page).toHaveURL(new RegExp(`\\?q=${tag}&open=1$`));
    await expect(openOnly(page)).toHaveAttribute("aria-checked", "true");
    await expect(titles(page)).toHaveText([chimney, gutters, reroof]);
    await expect(figures(page)).toHaveText(["3", "$1,900.00"]);

    // value sorts as money both ways, the blank value last
    await valueHeading(page).getByRole("link").click();
    await expect(page).toHaveURL(new RegExp(`\\?q=${tag}&open=1&sort=value$`));
    await expect(valueHeading(page)).toHaveAttribute("aria-sort", "ascending");
    await expect(titles(page)).toHaveText([reroof, gutters, chimney]);
    await valueHeading(page).getByRole("link").click();
    await expect(page).toHaveURL(new RegExp(`\\?q=${tag}&open=1&sort=value&dir=desc$`));
    await expect(titles(page)).toHaveText([gutters, reroof, chimney]);

    // a reload, and the same address in a new tab, show the same view
    await page.reload();
    await expect(titles(page)).toHaveText([gutters, reroof, chimney], COLD);
    await expect(search(page)).toHaveValue(tag);
    await expect(openOnly(page)).toHaveAttribute("aria-checked", "true");
    await expect(valueHeading(page)).toHaveAttribute("aria-sort", "descending");
    const other = await page.context().newPage();
    await other.goto(page.url());
    await expect(titles(other)).toHaveText([gutters, reroof, chimney], COLD);
    await other.close();

    // Won with open only matches nothing; the clear link keeps the sort
    await pickStage(page, "Won", /stage=Won/);
    await expect(page.getByText(`No deals match "${tag}" with these filters.`)).toBeVisible();
    await expect(figures(page)).toHaveText(["0", "$0.00"]);
    await page.getByRole("link", { name: "Clear search and filters" }).click();
    await expect(page).toHaveURL(/\/deals\?sort=value&dir=desc$/);
    await expect(search(page)).toHaveValue("");
    await expect(stage(page)).toHaveValue("");
    await expect(openOnly(page)).toHaveAttribute("aria-checked", "false");

    // a deal is found by its company's name, any capitals
    await typeSearch(page, `ACME ROOFING ${tag}`);
    await expect(titles(page)).toHaveText([reroof]);
  });
});

test.describe("at phone width", () => {
  test.use({ storageState: OWNER_STATE, viewport: { width: 390, height: 844 } });

  test("Search, Stage, Open only and Sort by fit and work from the keyboard", async ({ page }) => {
    const tag = `qe${Date.now()}`;
    await addDeal(page, `Small job ${tag}`, "900", "New");
    await addDeal(page, `Big job ${tag}`, "1,000", "Lost");

    await page.goto("/deals");
    await expect(page.getByRole("heading", { name: "Deals", level: 1 })).toBeVisible(COLD);
    await typeSearch(page, tag);
    const blocks = page.getByRole("list", { name: "Deals" }).getByRole("listitem");
    await expect(blocks).toHaveCount(2);

    // Sort by, from the keyboard: Enter opens it, the chosen link sorts
    await expect(page.locator("summary")).toContainText("Newest added first");
    await page.locator("summary").focus();
    await page.keyboard.press("Enter");
    await page.getByRole("link", { name: "Value, highest first" }).focus();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(new RegExp(`\\?q=${tag}&sort=value&dir=desc$`));
    await expect(page.locator("summary")).toContainText("Value, highest first");
    await expect(blocks.first()).toContainText(`Big job ${tag}`);

    // Open only, with Space; the Lost deal goes
    await openOnly(page).focus();
    await page.keyboard.press("Space");
    await expect(page).toHaveURL(new RegExp(`\\?q=${tag}&sort=value&dir=desc&open=1$`));
    await expect(blocks).toHaveCount(1);
    await expect(blocks.first()).toContainText(`Small job ${tag}`);

    const fits = await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);
    expect(fits).toBe(true);
  });
});
