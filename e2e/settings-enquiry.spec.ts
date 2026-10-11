import { expect, test } from "@playwright/test";
import { OWNER_STATE } from "./owner";

test.describe("as the owner", () => {
  test.use({ storageState: OWNER_STATE, permissions: ["clipboard-read", "clipboard-write"] });

  test("Settings shows the enquiry form's address, and Copy puts it on the clipboard", async ({ page, baseURL }) => {
    await page.goto("/settings");
    const section = page.getByRole("region", { name: "Your enquiry form" });
    await expect(section.getByText("Put this link on your website. Anyone can use it to ask you for a quote, without an account.")).toBeVisible();

    // the e2e server's own address (env.authUrl) is the baseURL
    const address = `${baseURL}/enquire`;
    const link = section.getByRole("link", { name: address });
    await expect(link).toHaveAttribute("href", address);

    await section.getByRole("button", { name: "Copy" }).click();
    await expect(section.getByRole("button", { name: "Copied" })).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(address);
    await expect(section.getByRole("button", { name: "Copy" })).toBeVisible({ timeout: 5_000 });
  });

  test("when the browser refuses to copy, it says how to copy by hand", async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator.clipboard, "writeText", { value: () => Promise.reject(new Error("denied")) });
    });
    await page.goto("/settings");
    const section = page.getByRole("region", { name: "Your enquiry form" });
    await section.getByRole("button", { name: "Copy" }).click();
    await expect(section.getByRole("alert")).toHaveText("Couldn't copy. Select the address and copy it.");
  });

  test("a long address wraps on a phone rather than scrolling sideways", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/settings");
    const link = page.getByRole("region", { name: "Your enquiry form" }).getByRole("link");
    // the local address is short; give the link a production-length one with no natural break points
    await link.evaluate((a) => { a.textContent = "https://guildhall-reference-git-main-brainit-consulting-projects.vercel.app/enquire"; });
    const box = await link.boundingBox();
    expect(box!.height).toBeGreaterThan(30); // it wrapped onto more than one line
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
});
