import { expect, test, type Page } from "@playwright/test";
import { OWNER_STATE } from "./owner";

// The dev server compiles each page on its first visit; every wait for a newly opened page uses this.
const COLD = { timeout: 30_000 };

const search = (page: Page) => page.getByRole("searchbox", { name: "Search" });
const names = (page: Page) => page.getByRole("table").getByRole("row").locator("td:first-child");
const nameHeading = (page: Page) => page.getByRole("columnheader", { name: "Name" });

async function addCompany(page: Page, name: string, website = "") {
  await page.goto("/companies/new");
  await page.getByLabel("Name").fill(name);
  await page.getByLabel("Website").fill(website);
  await page.getByRole("button", { name: "Add company" }).click();
  await expect(page.getByRole("heading", { name, level: 1 })).toBeVisible(COLD);
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

test.describe("as the owner", () => {
  test.use({ storageState: OWNER_STATE, viewport: { width: 1280, height: 800 } });

  test("searching as you type, sorting both ways, and a reload keeps the view", async ({ page }) => {
    test.slow(); // four companies are added through the form first
    // tests share one database, so this test's companies carry a word nobody else's do
    const tag = `qz${Date.now()}`;
    const acme = `ACME Roofing ${tag}`;
    const lynn = `Lynn Tilers ${tag}`;
    const bishop = `bishop's glass ${tag}`;
    await addCompany(page, acme);
    await addCompany(page, lynn, `www.Acme-tiles-${tag}.example`);
    await addCompany(page, bishop, `bishops-${tag}.example`);
    await addCompany(page, `100% Thatch ${tag}`);

    await page.goto("/companies");
    await expect(page.getByRole("heading", { name: "Companies", level: 1 })).toBeVisible(COLD);
    // no sort chosen: newest first and no arrow
    await expect(page.locator("th[aria-sort]")).toHaveCount(0);

    // "acme" in a name or a website, any capitals, without Enter; the box keeps its focus and every character
    await typeSearch(page, "acme");
    await expect(page).toHaveURL(/\/companies\?q=acme$/);
    await expect(search(page)).toBeFocused();
    await expect(search(page)).toHaveValue("acme");
    await expect(page.getByRole("link", { name: acme })).toBeVisible();
    await expect(page.getByRole("link", { name: lynn })).toBeVisible();
    await expect(page.getByRole("link", { name: bishop })).toHaveCount(0);

    // just this test's companies, then Name A to Z, then Z to A, ignoring capitals
    await typeSearch(page, tag);
    await nameHeading(page).getByRole("link").click();
    await expect(page).toHaveURL(new RegExp(`\\?q=${tag}&sort=name$`));
    await expect(nameHeading(page)).toHaveAttribute("aria-sort", "ascending");
    await expect(names(page)).toHaveText([`100% Thatch ${tag}`, acme, bishop, lynn]);
    await nameHeading(page).getByRole("link").click();
    await expect(page).toHaveURL(new RegExp(`\\?q=${tag}&sort=name&dir=desc$`));
    await expect(nameHeading(page)).toHaveAttribute("aria-sort", "descending");
    await expect(names(page)).toHaveText([lynn, bishop, acme, `100% Thatch ${tag}`]);

    // a reload, and the same address in a new tab, show the same view
    await page.reload();
    await expect(names(page)).toHaveText([lynn, bishop, acme, `100% Thatch ${tag}`], COLD);
    await expect(search(page)).toHaveValue(tag);
    const other = await page.context().newPage();
    await other.goto(page.url());
    await expect(names(other)).toHaveText([lynn, bishop, acme, `100% Thatch ${tag}`], COLD);
    await other.close();

    // searching keeps the sort; the heading is reached with Tab and sorts with Enter
    await typeSearch(page, `glass ${tag}`);
    await expect(page).toHaveURL(/sort=name&dir=desc/);
    await expect(names(page)).toHaveText([bishop]);
    await nameHeading(page).getByRole("link").focus();
    await page.keyboard.press("Enter");
    await expect(nameHeading(page)).toHaveAttribute("aria-sort", "ascending");

    // nothing matches: say so, and Clear search keeps the sort
    await typeSearch(page, `nobody ${tag}`);
    await expect(page.getByText(`No matches for "nobody ${tag}".`)).toBeVisible();
    await page.getByRole("link", { name: "Clear search" }).click();
    await expect(page).toHaveURL(/\/companies\?sort=name$/);
    await expect(search(page)).toHaveValue("");
    await expect(nameHeading(page)).toHaveAttribute("aria-sort", "ascending");
  });

  test("% and _ match themselves, and a junk address shows the default list", async ({ page }) => {
    const tag = `qw${Date.now()}`;
    await addCompany(page, `50% Off ${tag}`);
    await addCompany(page, `Plain ${tag}`);

    await page.goto("/companies?q=%25");
    await expect(page.getByRole("link", { name: `50% Off ${tag}` })).toBeVisible(COLD);
    await expect(page.getByRole("link", { name: `Plain ${tag}` })).toHaveCount(0);
    for (const text of await names(page).allTextContents()) expect(text).toContain("%");

    await page.goto(`/companies?q=_${tag}`);
    await expect(page.getByText(`No matches for "_${tag}".`)).toBeVisible(COLD);

    const res = await page.goto("/companies?sort=drop&dir=sideways");
    expect(res?.status()).toBe(200);
    await expect(page.getByRole("heading", { name: "Companies", level: 1 })).toBeVisible(COLD);
    await expect(page.locator("th[aria-sort]")).toHaveCount(0);
  });
});

test.describe("at phone width", () => {
  test.use({ storageState: OWNER_STATE, viewport: { width: 390, height: 844 } });

  test("Search and Sort by work and nothing scrolls sideways", async ({ page }) => {
    const tag = `qp${Date.now()}`;
    await addCompany(page, `Alder Joinery ${tag}`);
    await addCompany(page, `Yarmouth Smiths ${tag}`);

    await page.goto("/companies");
    await expect(page.getByRole("heading", { name: "Companies", level: 1 })).toBeVisible(COLD);
    await typeSearch(page, tag);
    const blocks = page.getByRole("list", { name: "Companies" }).getByRole("listitem");
    await expect(blocks).toHaveCount(2);

    // the Sort by control, from the keyboard: Enter opens it, the chosen link sorts
    const sortBy = page.getByText("Sort by:");
    await expect(page.locator("summary")).toContainText("Newest added first");
    await page.locator("summary").focus();
    await page.keyboard.press("Enter");
    await page.getByRole("link", { name: "Name, Z to A" }).focus();
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(new RegExp(`\\?q=${tag}&sort=name&dir=desc$`));
    await expect(page.locator("summary")).toContainText("Name, Z to A");
    await expect(blocks.first()).toContainText(`Yarmouth Smiths ${tag}`);
    await expect(sortBy).toBeVisible();

    const fits = await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);
    expect(fits).toBe(true);
  });
});
