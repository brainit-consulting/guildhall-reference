import { expect, test, type Page } from "@playwright/test";
import { OWNER, OWNER_STATE } from "./owner";

// The dev server compiles each page on its first visit; every wait for a newly opened page uses this.
const COLD = { timeout: 30_000 };

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
// Today as the browser sees it, the way the timeline writes it ("12 Oct 2026").
async function today(page: Page): Promise<string> {
  const [y, m, d] = await page.evaluate(() => { const n = new Date(); return [n.getFullYear(), n.getMonth(), n.getDate()]; });
  return `${d} ${MONTHS[m]} ${y}`;
}

const timeline = (page: Page) => page.getByRole("list", { name: "Timeline" });

// Logs an activity once: saving isn't safe to retry. The form posts without JavaScript too, so it works before the
// page has hydrated.
async function log(page: Page, kind: string, text: string) {
  await page.getByRole("radio", { name: kind }).check();
  await page.getByLabel("What happened").fill(text);
  await page.getByRole("button", { name: "Log activity" }).click();
  await expect(timeline(page).getByText(text, { exact: true })).toBeVisible(COLD);
}

test.describe("as the owner", () => {
  test.use({ storageState: OWNER_STATE });

  test("a call logged on a contact heads its timeline, with who and when", async ({ page }) => {
    const person = `Wat Tyler ${Date.now()}`;
    await page.goto("/contacts/new");
    await page.getByLabel("Name").fill(person);
    await page.getByRole("button", { name: "Add contact" }).click();
    await expect(page.getByRole("heading", { name: person, level: 1 })).toBeVisible(COLD);
    await expect(page.getByText("Nothing logged yet. Log a call, meeting or note above.")).toBeVisible();

    await log(page, "Call", "Rang about the roof. Wants a quote by Friday.");
    await log(page, "Meeting", "Walked the site with him.");

    const entries = timeline(page).getByRole("listitem");
    await expect(entries).toHaveCount(2);
    await expect(entries.nth(0)).toContainText("Meeting");
    await expect(entries.nth(0)).toContainText("Walked the site with him.");
    await expect(entries.nth(1)).toContainText("Call");
    await expect(entries.nth(1)).toContainText("Rang about the roof. Wants a quote by Friday.");
    await expect(entries.nth(1)).toContainText(`${OWNER.name}, ${await today(page)}`);
    // the form is emptied for the next one
    await expect(page.getByLabel("What happened")).toHaveValue("");

    // still there after a reload, and no database ids on the page
    await page.reload();
    await expect(timeline(page).getByRole("listitem")).toHaveCount(2, COLD);
    const id = new URL(page.url()).pathname.split("/").pop()!;
    await expect(page.locator("main")).not.toContainText(id);
  });

  test("a note logged on a deal shows on the deal's timeline", async ({ page }) => {
    const title = `Re-glaze the chapel ${Date.now()}`;
    await page.goto("/deals/new");
    await page.getByLabel("Title").fill(title);
    await page.getByRole("button", { name: "Add deal" }).click();
    await expect(page.getByRole("heading", { name: title, level: 1 })).toBeVisible(COLD);

    await log(page, "Note", "Asked for lead-light samples.");
    const entry = timeline(page).getByRole("listitem");
    await expect(entry).toHaveCount(1);
    await expect(entry).toContainText("Note");
    await expect(entry).toContainText(`${OWNER.name}, ${await today(page)}`);

    // clean up the deal, so other tests' open totals stay as they were
    await expect(async () => {
      await page.getByRole("button", { name: "Delete" }).click();
      await expect(page.getByRole("dialog")).toBeVisible({ timeout: 1_000 });
    }).toPass(COLD);
    await page.getByRole("dialog").getByRole("button", { name: "Delete" }).click();
    await expect(page).toHaveURL(/\/deals$/, COLD);
  });

  test("a call on a deal's contact is the deal's last activity, on its page and in the table", async ({ page }) => {
    test.slow(); // several pages compile on first visit
    const stamp = Date.now();
    const person = `Jack Straw ${stamp}`;
    const title = `Thatch the tithe barn ${stamp}`;
    await page.goto("/contacts/new");
    await page.getByLabel("Name").fill(person);
    await page.getByRole("button", { name: "Add contact" }).click();
    await expect(page.getByRole("heading", { name: person, level: 1 })).toBeVisible(COLD);
    const contactUrl = page.url();

    await page.goto("/deals/new");
    await page.getByLabel("Title").fill(title);
    const box = page.getByRole("combobox", { name: "Contact" });
    await expect(async () => {
      await box.fill("");
      await box.fill(`straw ${stamp}`);
      await expect(page.getByRole("option", { name: new RegExp(person) })).toBeVisible({ timeout: 1_000 });
    }).toPass(COLD);
    await page.getByRole("option", { name: new RegExp(person) }).click();
    await page.getByRole("button", { name: "Add deal" }).click();
    await expect(page.getByRole("heading", { name: title, level: 1 })).toBeVisible(COLD);
    const dealUrl = page.url();
    await expect(page.getByText("Nothing logged yet", { exact: true })).toBeVisible();

    await page.goto(contactUrl);
    await log(page, "Call", "Rang about the thatch.");

    await page.goto(dealUrl);
    await expect(page.getByRole("heading", { name: title, level: 1 })).toBeVisible(COLD);
    const last = page.locator("dl > div").filter({ hasText: "Last activity" });
    await expect(last).toContainText("today");
    await expect(last.locator("time")).toHaveAttribute("title", await today(page));
    await expect(page.getByText("Nothing logged yet. Log a call, meeting or note above.")).toBeVisible(); // the call is on the contact

    await page.goto("/deals");
    const row = page.getByRole("row").filter({ has: page.getByRole("link", { name: title, exact: true }) });
    await expect(row.getByRole("cell").last()).toHaveText("today", COLD);

    // clean up the deal, so other tests' open totals stay as they were
    await page.goto(dealUrl);
    await expect(async () => {
      await page.getByRole("button", { name: "Delete" }).click();
      await expect(page.getByRole("dialog")).toBeVisible({ timeout: 1_000 });
    }).toPass(COLD);
    await page.getByRole("dialog").getByRole("button", { name: "Delete" }).click();
    await expect(page).toHaveURL(/\/deals$/, COLD);
  });

  test("a company has Log activity too, and empty text is explained", async ({ page }) => {
    const company = `Lynn Tilers ${Date.now()}`;
    await page.goto("/companies/new");
    await page.getByLabel("Name").fill(company);
    await page.getByRole("button", { name: "Add company" }).click();
    await expect(page.getByRole("heading", { name: company, level: 1 })).toBeVisible(COLD);

    await page.getByRole("button", { name: "Log activity" }).click();
    await expect(page.getByText("Write what happened.")).toBeVisible(COLD);
    await expect(page.getByText("Nothing logged yet. Log a call, meeting or note above.")).toBeVisible();
    await log(page, "Meeting", "Met at the yard.");
  });
});

test.describe("at phone width", () => {
  test.use({ storageState: OWNER_STATE, viewport: { width: 390, height: 844 } });

  test("the timeline fits", async ({ page }) => {
    const person = `Margery Brews ${Date.now()}`;
    await page.goto("/contacts/new");
    await page.getByLabel("Name").fill(person);
    await page.getByRole("button", { name: "Add contact" }).click();
    await expect(page.getByRole("heading", { name: person, level: 1 })).toBeVisible(COLD);
    await log(page, "Note", `A very long note without spaces ${"x".repeat(200)}`);
    const fits = await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);
    expect(fits).toBe(true);
  });
});
