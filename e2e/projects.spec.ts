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

// Clicks once the page has hydrated: a form's action only runs then.
async function pressUntil(page: Page, button: string, then: () => Promise<void>) {
  await expect(async () => {
    await page.getByRole("button", { name: button }).click();
    await then();
  }).toPass(COLD);
}

test.describe("as the owner", () => {
  test.use({ storageState: OWNER_STATE });

  test("add a project on a client's page, see it on /projects and the client, mark it done", async ({ page }) => {
    test.slow(); // several pages compile on first visit
    const stamp = Date.now();
    const company = `Fen Mill ${stamp}`;
    const deal = `Mill doors ${stamp}`;
    const name = `Oak staircase ${stamp}`;

    // a client, made the way the app makes one: a Won deal of a company
    await page.goto("/companies/new");
    await page.getByLabel("Name").fill(company);
    await page.getByRole("button", { name: "Add company" }).click();
    await expect(page.getByRole("heading", { name: company, level: 1 })).toBeVisible(COLD);
    await page.goto("/deals/new");
    await page.getByLabel("Title").fill(deal);
    await page.getByLabel("Stage").selectOption("Won");
    await pick(page, "Company", company);
    await page.getByRole("button", { name: "Add deal" }).click();
    await expect(page.getByRole("heading", { name: deal, level: 1 })).toBeVisible(COLD);
    const dealPath = new URL(page.url()).pathname;
    await pressUntil(page, "Make client", () => expect(page.getByRole("heading", { name: company, level: 1 })).toBeVisible({ timeout: 2_000 }));
    const clientPath = new URL(page.url()).pathname;
    await expect(page.getByText("No projects for this client yet.")).toBeVisible();

    // Add project, with the client already picked; an end before the start is refused
    await page.getByRole("link", { name: "Add project" }).click();
    await expect(page.getByRole("heading", { name: "Add project", level: 1 })).toBeVisible(COLD);
    await expect(page.getByLabel("Client").locator("option:checked")).toHaveText(company);
    await page.getByLabel("Name").fill(name);
    await page.getByLabel("Budget (USD)").fill("4,500");
    await page.getByLabel("Start").fill("2026-11-02");
    await page.getByLabel("End").fill("2026-11-01");
    await pressUntil(page, "Add project", () => expect(page.getByRole("main").getByRole("alert")).toHaveText("The end can't be before the start.", { timeout: 2_000 }));
    await expect(page.getByLabel("Name")).toHaveValue(name);
    await page.getByLabel("End").fill("2026-12-18");
    await page.getByRole("button", { name: "Add project" }).click();

    // the project's page
    await expect(page.getByRole("heading", { name, level: 1 })).toBeVisible(COLD);
    const projectPath = new URL(page.url()).pathname;
    await expect(page.getByRole("definition")).toHaveText([company, "Active", "$4,500.00", "2 Nov 2026", "18 Dec 2026"]);

    // on the client's page
    await page.goto(clientPath);
    await expect(page.getByRole("list", { name: "Projects" }).getByRole("link")).toHaveText([name], COLD);

    // on /projects, opened from the menu
    await page.goto("/home");
    await menu(page).getByRole("link", { name: "Projects" }).click();
    await expect(page.getByRole("heading", { name: "Projects", level: 1 })).toBeVisible(COLD);
    const row = page.getByRole("table", { name: "Projects" }).getByRole("row").filter({ hasText: name });
    await expect(row.getByRole("cell")).toHaveText([name, company, "Active", "$4,500.00", "2 Nov 2026", "18 Dec 2026"]);

    // Mark done
    await page.goto(projectPath);
    await pressUntil(page, "Mark done", () => expect(page.getByRole("button", { name: "Mark active" })).toBeVisible({ timeout: 2_000 }));
    await expect(page.getByRole("definition").nth(1)).toHaveText("Done");
    await page.goto("/projects");
    await expect(row.getByRole("cell").nth(2)).toHaveText("Done", COLD);

    // Delete asks first; Cancel keeps it
    await page.goto(projectPath);
    await pressUntil(page, "Delete", () => expect(page.getByRole("dialog")).toBeVisible({ timeout: 1_000 }));
    await page.getByRole("dialog").getByRole("button", { name: "Cancel" }).click();
    await expect(page.getByRole("dialog")).toBeHidden();
    await page.getByRole("button", { name: "Delete" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Delete" }).click();
    await expect(page).toHaveURL(/\/projects$/, COLD);
    await expect(page.getByRole("link", { name })).toHaveCount(0);

    // so other tests' figures stay as they were
    await page.goto(dealPath);
    await pressUntil(page, "Delete", () => expect(page.getByRole("dialog")).toBeVisible({ timeout: 1_000 }));
    await page.getByRole("dialog").getByRole("button", { name: "Delete" }).click();
    await expect(page).toHaveURL(/\/deals$/, COLD);
  });
});
