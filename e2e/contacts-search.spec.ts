import { expect, test, type Page } from "@playwright/test";
import { OWNER_STATE } from "./owner";

// The dev server compiles each page on its first visit; every wait for a newly opened page uses this.
const COLD = { timeout: 30_000 };

const search = (page: Page) => page.getByRole("searchbox", { name: "Search" });
const names = (page: Page) => page.getByRole("table").getByRole("row").locator("td:first-child");
const heading = (page: Page, name: string) => page.getByRole("columnheader", { name });

async function addCompany(page: Page, name: string) {
  await page.goto("/companies/new");
  await page.getByLabel("Name").fill(name);
  await page.getByRole("button", { name: "Add company" }).click();
  await expect(page.getByRole("heading", { name, level: 1 })).toBeVisible(COLD);
}

// The company picker works once the page has hydrated; typing before then is tried again.
async function addContact(page: Page, name: string, { email = "", company = "" } = {}) {
  await page.goto("/contacts/new");
  await page.getByLabel("Name").fill(name);
  await page.getByLabel("Email").fill(email);
  if (company) {
    const box = page.getByRole("combobox", { name: "Company" });
    await expect(async () => {
      await box.fill("");
      await box.fill(company);
      await expect(page.getByRole("option", { name: company })).toBeVisible({ timeout: 1_000 });
    }).toPass(COLD);
    await page.getByRole("option", { name: company }).click();
  }
  await page.getByRole("button", { name: "Add contact" }).click();
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

  test("searching name, email and company, sorting by company both ways, and a reload keeps the view", async ({ page }) => {
    test.slow(); // two companies and four contacts are added through the forms first
    // tests share one database, so this test's records carry a word nobody else's do
    const tag = `qc${Date.now()}`;
    const acme = `ACME Roofing ${tag}`;
    const lynn = `Lynn Tilers ${tag}`;
    const agnes = `agnes Paston ${tag}`;
    const wat = `Wat Tyler ${tag}`;
    const margery = `Margery Kempe ${tag}`;
    const john = `John Acmeson ${tag}`;
    await addCompany(page, acme);
    await addCompany(page, lynn);
    await addContact(page, agnes, { company: acme });
    await addContact(page, wat, { email: `wat@lynn-${tag}.example`, company: lynn });
    await addContact(page, margery, { email: `Margery@Acme-${tag}.example` });
    await addContact(page, john);

    await page.goto("/contacts");
    await expect(page.getByRole("heading", { name: "Contacts", level: 1 })).toBeVisible(COLD);
    await expect(page.locator("th[aria-sort]")).toHaveCount(0);

    // "acme" in a name, an email or a company name, any capitals, without Enter; the box keeps its focus
    await typeSearch(page, "acme");
    await expect(page).toHaveURL(/\/contacts\?q=acme$/);
    await expect(search(page)).toBeFocused();
    for (const name of [agnes, margery, john]) await expect(page.getByRole("link", { name })).toBeVisible();
    await expect(page.getByRole("link", { name: wat })).toHaveCount(0);

    // just this test's contacts, then Company A to Z and Z to A, no company last both times
    await typeSearch(page, tag);
    await heading(page, "Company").getByRole("link").click();
    await expect(page).toHaveURL(new RegExp(`\\?q=${tag}&sort=company$`));
    await expect(heading(page, "Company")).toHaveAttribute("aria-sort", "ascending");
    await expect(names(page)).toHaveText([agnes, wat, john, margery]);
    await heading(page, "Company").getByRole("link").click();
    await expect(page).toHaveURL(new RegExp(`\\?q=${tag}&sort=company&dir=desc$`));
    await expect(heading(page, "Company")).toHaveAttribute("aria-sort", "descending");
    await expect(names(page)).toHaveText([wat, agnes, john, margery]);

    // a reload, and the same address in a new tab, show the same view
    await page.reload();
    await expect(names(page)).toHaveText([wat, agnes, john, margery], COLD);
    await expect(search(page)).toHaveValue(tag);
    const other = await page.context().newPage();
    await other.goto(page.url());
    await expect(names(other)).toHaveText([wat, agnes, john, margery], COLD);
    await other.close();

    // searching keeps the sort, and sorting keeps the search
    await typeSearch(page, `acme-${tag}`);
    await expect(page).toHaveURL(/sort=company&dir=desc/);
    await expect(names(page)).toHaveText([margery]);
    await typeSearch(page, tag);
    await heading(page, "Name").getByRole("link").click();
    await expect(page).toHaveURL(new RegExp(`\\?q=${tag}&sort=name$`));
    await expect(names(page)).toHaveText([agnes, john, margery, wat]);

    // nothing matches: say so, and Clear search keeps the sort
    await typeSearch(page, `nobody ${tag}`);
    await expect(page.getByText(`No matches for "nobody ${tag}".`)).toBeVisible();
    await page.getByRole("link", { name: "Clear search" }).click();
    await expect(page).toHaveURL(/\/contacts\?sort=name$/);
    await expect(search(page)).toHaveValue("");
    await expect(heading(page, "Name")).toHaveAttribute("aria-sort", "ascending");
  });
});

test.describe("at phone width", () => {
  test.use({ storageState: OWNER_STATE, viewport: { width: 390, height: 844 } });

  test("Search and Sort by work and nothing scrolls sideways", async ({ page }) => {
    const tag = `qd${Date.now()}`;
    await addContact(page, `Alder Joiner ${tag}`, { email: `a-very-long-address-for-alder-${tag}@joinery.example` });
    await addContact(page, `Yarmouth Smith ${tag}`);

    await page.goto("/contacts");
    await expect(page.getByRole("heading", { name: "Contacts", level: 1 })).toBeVisible(COLD);
    await typeSearch(page, tag);
    const blocks = page.getByRole("list", { name: "Contacts" }).getByRole("listitem");
    await expect(blocks).toHaveCount(2);

    // every column is offered both ways; the chosen link sorts
    await expect(page.locator("summary")).toContainText("Newest added first");
    await page.locator("summary").click();
    for (const label of ["Name", "Company", "Email", "Phone", "Job title"]) {
      await expect(page.getByRole("link", { name: `${label}, A to Z` })).toBeVisible();
      await expect(page.getByRole("link", { name: `${label}, Z to A` })).toBeVisible();
    }
    await page.getByRole("link", { name: "Email, A to Z" }).click();
    await expect(page).toHaveURL(new RegExp(`\\?q=${tag}&sort=email$`));
    await expect(page.locator("summary")).toContainText("Email, A to Z");
    await expect(blocks.first()).toContainText(`Alder Joiner ${tag}`);
    await expect(blocks.last()).toContainText(`Yarmouth Smith ${tag}`);

    const fits = await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);
    expect(fits).toBe(true);
  });
});
