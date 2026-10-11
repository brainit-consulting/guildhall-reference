import { expect, test, type Page } from "@playwright/test";
import { OWNER_STATE } from "./owner";

// The dev server compiles each page on its first visit; every wait for a newly opened page uses this.
const COLD = { timeout: 30_000 };

const heading = (page: Page) => page.getByRole("heading", { level: 1 });
// the desktop table's body rows, one per contact
const rows = (page: Page) => page.locator("table tbody tr");

// "Contacts 12" reads as 12; plain "Contacts" as none.
async function figure(page: Page): Promise<number> {
  const text = (await heading(page).textContent()) ?? "";
  const match = /^Contacts(?: (\d+))?$/.exec(text.trim());
  expect(match, `heading "${text}"`).not.toBeNull();
  return Number(match![1] ?? 0);
}

test.describe("as the owner", () => {
  test.use({ storageState: OWNER_STATE, viewport: { width: 1280, height: 800 } });

  test("the heading counts the contacts, goes up when one is added and down when it's deleted", async ({ page }) => {
    test.slow(); // the list, the add form and the contact page each compile on first visit
    await page.goto("/contacts");
    await expect(heading(page)).toBeVisible(COLD);
    const before = await figure(page);
    // the figure is the number of contacts the list shows
    await expect(rows(page)).toHaveCount(before);
    if (before > 0) await expect(heading(page).locator("span")).toHaveClass(/text-muted/);
    else await expect(heading(page)).toHaveText("Contacts");

    const name = `Margery Kempe ${Date.now()}`;
    await page.getByRole("link", { name: "Add contact" }).click();
    await expect(page.getByRole("heading", { name: "Add contact", level: 1 })).toBeVisible(COLD);
    await page.getByLabel("Name").fill(name);
    await page.getByRole("button", { name: "Add contact" }).click();
    await expect(page.getByRole("heading", { name, level: 1 })).toBeVisible(COLD);
    const contactPath = new URL(page.url()).pathname;

    await page.goto("/contacts");
    await expect(heading(page)).toHaveText(`Contacts ${before + 1}`, COLD);
    await expect(heading(page).locator("span")).toHaveClass(/text-muted/);

    // a search narrows the list, not the figure
    await page.goto(`/contacts?q=${encodeURIComponent(name)}`);
    await expect(rows(page)).toHaveCount(1, COLD);
    await expect(heading(page)).toHaveText(`Contacts ${before + 1}`);

    // deleting it takes it off the figure
    await page.goto(contactPath);
    await expect(async () => {
      await page.getByRole("button", { name: "Delete" }).click();
      await expect(page.getByRole("dialog")).toBeVisible({ timeout: 1_000 });
    }).toPass(COLD);
    await page.getByRole("dialog").getByRole("button", { name: "Delete" }).click();
    await expect(page).toHaveURL(/\/contacts$/, COLD);
    await expect(heading(page)).toHaveText(before > 0 ? `Contacts ${before}` : "Contacts", COLD);
  });
});
