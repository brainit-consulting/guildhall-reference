import { expect, test, type Page } from "@playwright/test";
import { OWNER_STATE } from "./owner";

const menu = (page: Page) => page.getByRole("navigation", { name: "Main" });

// The dev server compiles each page on its first visit; every wait for a newly opened page uses this.
const COLD = { timeout: 30_000 };

// The picker works once the page has hydrated; typing before then is tried again.
async function pick(page: Page, box: string, typed: string) {
  const combobox = page.getByRole("combobox", { name: box });
  await expect(async () => {
    await combobox.fill("");
    await combobox.fill(typed);
    await expect(page.getByRole("option", { name: typed })).toBeVisible({ timeout: 1_000 });
  }).toPass(COLD);
  await page.getByRole("option", { name: typed }).click();
}

async function addDeal(page: Page, title: string, company: string, person: string | null, stage: string) {
  await page.goto("/deals/new");
  await page.getByLabel("Title").fill(title);
  await page.getByLabel("Stage").selectOption(stage);
  if (person) await pick(page, "Contact", person);
  await pick(page, "Company", company);
  await page.getByRole("button", { name: "Add deal" }).click();
  await expect(page.getByRole("heading", { name: title, level: 1 })).toBeVisible(COLD);
  return new URL(page.url()).pathname;
}

// Clicks once the page has hydrated: the form's action only runs then.
async function makeClient(page: Page, client: string) {
  await expect(async () => {
    await page.getByRole("button", { name: "Make client" }).click();
    await expect(page.getByRole("heading", { name: client, level: 1 })).toBeVisible({ timeout: 2_000 });
  }).toPass(COLD);
}

async function deleteDeal(page: Page, path: string) {
  await page.goto(path);
  await expect(async () => {
    await page.getByRole("button", { name: "Delete" }).click();
    await expect(page.getByRole("dialog")).toBeVisible({ timeout: 1_000 });
  }).toPass(COLD);
  await page.getByRole("dialog").getByRole("button", { name: "Delete" }).click();
  await expect(page).toHaveURL(/\/deals$/, COLD);
}

test.describe("as the owner", () => {
  test.use({ storageState: OWNER_STATE });

  test("Make client on two Won deals of one company makes one client with both", async ({ page }) => {
    test.slow(); // several pages compile on first visit
    const stamp = Date.now();
    const company = `Lynn Tilers ${stamp}`;
    const person = `Wat Tyler ${stamp}`;
    const roof = `Re-roof the hall ${stamp}`;
    const porch = `New porch ${stamp}`;

    await page.goto("/companies/new");
    await page.getByLabel("Name").fill(company);
    await page.getByRole("button", { name: "Add company" }).click();
    await expect(page.getByRole("heading", { name: company, level: 1 })).toBeVisible(COLD);
    await page.goto("/contacts/new");
    await page.getByLabel("Name").fill(person);
    await page.getByRole("button", { name: "Add contact" }).click();
    await expect(page.getByRole("heading", { name: person, level: 1 })).toBeVisible(COLD);

    // not yet won: no button
    const roofPath = await addDeal(page, roof, company, person, "Proposal");
    await expect(page.getByRole("button", { name: "Make client" })).toHaveCount(0);
    await page.goto(`${roofPath}/edit`);
    await page.getByLabel("Stage").selectOption("Won");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByRole("heading", { name: roof, level: 1 })).toBeVisible(COLD);

    // the client, made from the company, with the deal's contact as its contact person
    await makeClient(page, company);
    await expect(page).toHaveURL(/\/clients\/[^/]+$/);
    const clientPath = new URL(page.url()).pathname;
    await expect(page.getByRole("link", { name: company, exact: true })).toHaveAttribute("href", /\/companies\//);
    await expect(page.getByRole("link", { name: person, exact: true })).toHaveAttribute("href", /\/contacts\//);
    await expect(page.getByRole("list", { name: "Won deals" }).getByRole("link")).toHaveText([roof]);

    // the deal now shows its client instead of the button
    await page.goto(roofPath);
    await expect(page.getByRole("link", { name: company, exact: true }).last()).toBeVisible(COLD);
    await expect(page.getByRole("button", { name: "Make client" })).toHaveCount(0);

    // a second Won deal for the company reuses the client
    const porchPath = await addDeal(page, porch, company, null, "Won");
    await makeClient(page, company);
    expect(new URL(page.url()).pathname).toBe(clientPath);
    await expect(page.getByRole("list", { name: "Won deals" }).getByRole("link")).toHaveCount(2);

    // one row on /clients, opened from the menu, with both won deals
    await page.goto("/home");
    await menu(page).getByRole("link", { name: "Clients" }).click();
    await expect(page.getByRole("heading", { name: "Clients", level: 1 })).toBeVisible(COLD);
    const rows = page.getByRole("table", { name: "Clients" }).getByRole("row").filter({ hasText: company });
    await expect(rows).toHaveCount(1);
    await expect(rows.getByRole("cell")).toHaveText([company, person, "2"]);

    // so other tests' figures stay as they were
    await deleteDeal(page, roofPath);
    await deleteDeal(page, porchPath);
  });
});
