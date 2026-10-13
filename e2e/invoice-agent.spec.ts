import { expect, type Page } from "@playwright/test";
import { callTool, startSignIn, test, tokenFor } from "./agent";
import { OWNER_STATE } from "./owner";

// Invoicing through the agent (I12): Claude finds the client, drafts the invoice, and the owner opens the address it
// answers to check the Draft before sending it.
const COLD = { timeout: 60_000 };

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

test.use({ storageState: OWNER_STATE });

test("Claude drafts 10 hours of March work at 85 an hour for Acme; the owner opens the Draft and sees it in the log", async ({ page, agent: request, baseURL }) => {
  test.slow(); // several pages compile on first visit
  const company = `Acme ${Date.now()}`;

  // a client, made the way the app makes one: a Won deal of a company
  await page.goto("/companies/new");
  await page.getByLabel("Name").fill(company);
  await page.getByRole("button", { name: "Add company" }).click();
  await expect(page.getByRole("heading", { name: company, level: 1 })).toBeVisible(COLD);
  await page.goto("/deals/new");
  await page.getByLabel("Title").fill(`${company} fit-out`);
  await page.getByLabel("Stage").selectOption("Won");
  await pick(page, "Company", company);
  await page.getByRole("button", { name: "Add deal" }).click();
  await expect(page.getByRole("heading", { name: `${company} fit-out`, level: 1 })).toBeVisible(COLD);
  await expect(async () => {
    await page.getByRole("button", { name: "Make client" }).click();
    await expect(page.getByRole("heading", { name: company, level: 1 })).toBeVisible({ timeout: 2_000 });
  }).toPass(COLD);

  const { clientId, verifier, back } = await startSignIn(page, request, baseURL!, "Claude");
  await expect(page.getByRole("heading", { name: "Claude wants to use your Guildhall" })).toBeVisible(COLD);
  await page.getByRole("radio", { name: /Read and change/ }).check();
  await page.getByRole("button", { name: "Allow", exact: true }).click();
  const token = (await tokenFor(request, baseURL!, clientId, verifier, (await back).searchParams.get("code")!)).access_token;

  const [acme] = JSON.parse(await callTool(request, token, "list_clients", { query: company }));
  expect(acme.name).toBe(company);
  const answer = await callTool(request, token, "create_invoice_draft", {
    client_id: acme.id, lines: [{ description: "March work, hours", quantity: 10, unit_price: 85 }],
  });
  expect(answer).toMatch(new RegExp(`^Drafted INV-\\d{4,} for '${company}': \\$850\\.00 plus \\$[\\d,.]+ tax, `));
  const address = /at (http\S+\/invoices\/[\w-]+)\./.exec(answer)![1];
  const number = /^Drafted (INV-\d+)/.exec(answer)![1];

  // the address the agent answered opens the Draft, ready to check
  await page.goto(address);
  await expect(page.getByRole("heading", { name: number, level: 1 })).toBeVisible(COLD);
  await expect(page.getByRole("definition").nth(2)).toHaveText("Draft");
  const lines = page.getByRole("table", { name: "Lines" }).getByRole("row");
  await expect(lines.nth(1).getByRole("cell")).toHaveText(["March work, hours", "10", "$85.00", "$850.00"]);

  // the agent log links it by its number
  await page.goto("/settings/agent-log");
  // other tests' agents may log changes meanwhile
  const entry = page.getByRole("list", { name: "Changes" }).getByRole("listitem").filter({ hasText: `Drafted ${number} for '${company}'` });
  await expect(entry).toContainText(`Claude, for `, COLD);
  await expect(entry).toContainText("Tool: create_invoice_draft");
  await expect(entry).not.toContainText("/invoices/");
  await entry.getByRole("link", { name: `Invoice: ${number}` }).click();
  await expect(page).toHaveURL(address, COLD);
});
