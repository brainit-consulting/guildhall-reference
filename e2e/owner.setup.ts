import { expect, test as setup } from "@playwright/test";
import { OWNER, OWNER_STATE } from "./owner";

setup("the first person to sign up becomes the owner", async ({ page }) => {
  await page.goto("/signup");
  await page.getByLabel("Name").fill(OWNER.name);
  await page.getByLabel("Email").fill(OWNER.email);
  await page.getByLabel("Password").fill(OWNER.password);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/home$/);

  await page.goto("/settings");
  await expect(page.getByRole("heading", { name: "People who may sign up" })).toBeVisible();
  await page.context().storageState({ path: OWNER_STATE });
});
