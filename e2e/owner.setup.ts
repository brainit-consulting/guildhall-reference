import { expect, test as setup } from "@playwright/test";
import { OWNER, OWNER_STATE } from "./owner";

// The first request of the run: the dev server compiles the auth route, /home and /settings on the way, which takes
// longer than expect's 5s on a cold CI runner.
const COLD = { timeout: 60_000 };

setup("the first person to sign up becomes the owner", async ({ page }) => {
  await page.goto("/signup");
  await page.getByLabel("Name").fill(OWNER.name);
  await page.getByLabel("Email").fill(OWNER.email);
  await page.getByLabel("Password").fill(OWNER.password);
  await page.getByRole("button", { name: "Create account" }).click();

  // a retry finds the owner already signed up by the attempt that timed out; sign in as them instead
  const exists = page.getByRole("alert").filter({ hasText: "There is already an account for that email." });
  await expect(page.getByRole("heading", { name: `Welcome, ${OWNER.name}.` }).or(exists)).toBeVisible(COLD);
  if (await exists.isVisible()) {
    await page.goto("/signin");
    await page.getByLabel("Email").fill(OWNER.email);
    await page.getByLabel("Password").fill(OWNER.password);
    await page.getByRole("button", { name: "Sign in" }).click();
  }
  await expect(page).toHaveURL(/\/home$/, COLD);

  await page.goto("/settings");
  await expect(page.getByRole("heading", { name: "People who may sign up" })).toBeVisible(COLD);
  await page.context().storageState({ path: OWNER_STATE });
});
