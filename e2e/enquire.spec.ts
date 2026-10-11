import { expect, test, type Browser, type Page } from "@playwright/test";
import { BUSINESS_NAME } from "../src/lib/brand";
import { OWNER_STATE } from "./owner";

// The dev server compiles each page on its first visit; every wait for a newly opened page uses this.
const COLD = { timeout: 30_000 };

type Enquiry = { name: string; email: string; phone?: string; company?: string; message: string };

async function openForm(page: Page) {
  await page.goto("/enquire");
  await expect(page.getByRole("button", { name: "Send" })).toBeVisible(COLD);
}

async function fillForm(page: Page, e: Enquiry) {
  await page.getByLabel("Name").fill(e.name);
  await page.getByLabel("Email").fill(e.email);
  await page.getByLabel("Phone (optional)").fill(e.phone ?? "");
  await page.getByLabel("Company (optional)").fill(e.company ?? "");
  await page.getByLabel("What do you need?").fill(e.message);
}

async function send(page: Page, e: Enquiry) {
  await openForm(page);
  await fillForm(page, e);
  await page.getByRole("button", { name: "Send" }).click();
}

// The owner's view of the records, in a context of its own so the visitor's stays signed out.
async function asOwner<T>(browser: Browser, look: (page: Page) => Promise<T>, viewport = { width: 1280, height: 800 }) {
  const context = await browser.newContext({ storageState: OWNER_STATE, viewport });
  try {
    return await look(await context.newPage());
  } finally {
    await context.close();
  }
}

test.describe("signed out", () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test("the page is the business's, with nothing from the records", async ({ page }) => {
    await openForm(page);
    await expect(page).toHaveTitle(`Ask for a quote · ${BUSINESS_NAME}`);
    await expect(page.getByRole("heading", { name: BUSINESS_NAME, level: 1 })).toBeVisible();
    await expect(page.getByText("Ask for a quote. We'll get back to you.")).toBeVisible();
    await expect(page.getByRole("navigation")).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Sign in" })).toHaveCount(0);
    // the trap is in the form for bots, but not for people: out of the tab order and the accessibility tree
    await expect(page.getByRole("textbox", { name: "Leave this empty" })).toHaveCount(0);
    await expect(page.locator("#website")).toHaveAttribute("tabindex", "-1");
    await expect(page.getByRole("textbox", { name: "Name" })).toBeVisible();
  });

  test("an enquiry becomes a contact, a New deal marked Web form, and a note", async ({ page, browser }) => {
    const stamp = Date.now();
    const e = { name: `Wat Tyler ${stamp}`, email: `wat${stamp}@lynn.example`, phone: "01553 774411",
      company: `Tyler Roofing ${stamp}`, message: `A new roof on the barn, please. ${stamp}` };
    await send(page, e);
    await expect(page.getByRole("status")).toHaveText(`Thanks, ${e.name}. We'll be in touch.`, COLD);
    await expect(page.getByRole("button", { name: "Send" })).toHaveCount(0);

    await asOwner(browser, async (owner) => {
      await owner.goto(`/contacts?q=${encodeURIComponent(e.email)}`);
      await expect(owner.getByRole("table").getByRole("link", { name: e.name })).toBeVisible(COLD);

      await owner.goto(`/deals?q=${encodeURIComponent(e.email)}`);
      const row = owner.getByRole("row").filter({ hasText: `Enquiry from ${e.name}` });
      await expect(row).toBeVisible(COLD);
      await expect(row).toContainText("Web form");
      await expect(row).toContainText("New");

      await row.getByRole("link", { name: `Enquiry from ${e.name}` }).click();
      await expect(owner.getByRole("heading", { name: `Enquiry from ${e.name}`, level: 1 })).toBeVisible(COLD);
      const source = owner.locator("dl div").filter({ has: owner.locator("dt", { hasText: "Source" }) });
      await expect(source.locator("dd")).toHaveText("Web form");
      const note = owner.getByRole("list", { name: "Timeline" }).getByRole("listitem").filter({ hasText: e.message });
      await expect(note).toContainText("Web form,");
      await expect(note).not.toContainText("Someone no longer in Guildhall");
    });
  });

  test("the same email in other capitals gives one contact with two deals", async ({ page, browser }) => {
    const stamp = Date.now();
    const email = `joan${stamp}@lynn.example`;
    await send(page, { name: `Joan Ball ${stamp}`, email, message: "Gutters." });
    await expect(page.getByRole("status")).toBeVisible(COLD);
    await send(page, { name: `Joan Ball ${stamp}`, email: email.toUpperCase(), message: "And the porch." });
    await expect(page.getByRole("status")).toBeVisible(COLD);

    await asOwner(browser, async (owner) => {
      await owner.goto(`/contacts?q=${encodeURIComponent(email)}`);
      await expect(owner.getByRole("table").getByRole("link", { name: `Joan Ball ${stamp}` })).toHaveCount(1, COLD);
      await owner.goto(`/deals?q=${encodeURIComponent(email)}`);
      await expect(owner.getByRole("table").getByRole("link", { name: `Enquiry from Joan Ball ${stamp}` })).toHaveCount(2, COLD);
    });
  });

  test("with the hidden field filled, the thank-you shows and no deal is added", async ({ page, browser }) => {
    const stamp = Date.now();
    await openForm(page);
    await fillForm(page, { name: `Bot ${stamp}`, email: `bot${stamp}@spam.example`, message: "Cheap pills" });
    await page.locator("#website").evaluate((el: HTMLInputElement) => { el.value = "https://spam.example"; });
    await page.getByRole("button", { name: "Send" }).click();
    await expect(page.getByRole("status")).toHaveText(`Thanks, Bot ${stamp}. We'll be in touch.`, COLD);

    await asOwner(browser, async (owner) => {
      await owner.goto(`/deals?q=${encodeURIComponent(`Bot ${stamp}`)}`);
      await expect(owner.getByText(/No deals match/)).toBeVisible(COLD);
      await owner.goto(`/contacts?q=${encodeURIComponent(`bot${stamp}@spam.example`)}`);
      await expect(owner.getByText(/No matches for/)).toBeVisible(COLD);
    });
  });

  test("a missing name, email or message, or a bad email, is explained by its field and the typing is kept", async ({ page }) => {
    await openForm(page);
    await page.getByLabel("Phone (optional)").fill("01553 000000");
    await page.getByLabel("Company (optional)").fill("Lynn Mill");
    await page.getByRole("button", { name: "Send" }).click();
    await expect(page.getByText("Enter your name.")).toBeVisible(COLD);
    await expect(page.getByText("Enter your email address.")).toBeVisible();
    await expect(page.getByText("Tell us what you need.")).toBeVisible();
    await expect(page.getByLabel("Name")).toHaveAttribute("aria-describedby", "name-error");
    await expect(page.getByLabel("Phone (optional)")).toHaveValue("01553 000000");
    await expect(page.getByLabel("Company (optional)")).toHaveValue("Lynn Mill");

    await page.getByLabel("Name").fill("Margaret Paston");
    await page.getByLabel("Email").fill("margaret-at-paston");
    await page.getByLabel("What do you need?").fill("A quote for the hall.");
    await page.getByRole("button", { name: "Send" }).click();
    await expect(page.getByText("That doesn't look like an email address. Check it and try again.")).toBeVisible(COLD);
    await expect(page.getByText("Enter your name.")).toHaveCount(0);
    await expect(page.getByLabel("Name")).toHaveValue("Margaret Paston");
    await expect(page.getByLabel("Email")).toHaveValue("margaret-at-paston");
    await expect(page.getByLabel("What do you need?")).toHaveValue("A quote for the hall.");
    await expect(page.getByRole("status")).toHaveCount(0);
  });
});

test.describe("at phone width", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("the form fits, and the deal reads Web form on the phone list", async ({ page, browser }) => {
    await openForm(page);
    const fits = () => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);
    expect(await fits()).toBe(true);

    const stamp = Date.now();
    const name = `Kett ${stamp}`;
    await fillForm(page, { name, email: `kett${stamp}@lynn.example`, message: "Fencing." });
    await page.getByRole("button", { name: "Send" }).click();
    await expect(page.getByRole("status")).toBeVisible(COLD);
    expect(await fits()).toBe(true);

    await asOwner(browser, async (owner) => {
      await owner.goto(`/deals?q=${encodeURIComponent(name)}`);
      const block = owner.getByRole("list", { name: "Deals" }).getByRole("listitem").filter({ hasText: `Enquiry from ${name}` });
      await expect(block).toContainText("Web form", COLD);
    }, { width: 390, height: 844 });
  });
});

test.describe("signed in", () => {
  test.use({ storageState: OWNER_STATE, viewport: { width: 1280, height: 800 } });

  test("the owner sees the same form, and deals added by hand show no source", async ({ page }) => {
    await openForm(page);
    await expect(page.getByRole("heading", { name: BUSINESS_NAME, level: 1 })).toBeVisible();
    await expect(page.getByRole("navigation")).toHaveCount(0);

    const title = `Hand-added ${Date.now()}`;
    await page.goto("/deals/new");
    await page.getByLabel("Title").fill(title);
    await page.getByRole("button", { name: "Add deal" }).click();
    await expect(page.getByRole("heading", { name: title, level: 1 })).toBeVisible(COLD);
    await expect(page.locator("dt", { hasText: "Source" })).toHaveCount(0);
    await page.goto(`/deals?q=${encodeURIComponent(title)}`);
    await expect(page.getByRole("row").filter({ hasText: title })).not.toContainText("Web form", COLD);
  });
});
