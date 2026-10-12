import { expect, test } from "@playwright/test";
import { allowSignUp } from "./owner";

// The e2e server runs with DEMO_EMAIL set to this address (playwright.config.ts), as the live showcase does.
const DEMO = { name: "Demo", email: "demo@hollowoak.example", password: "showcase password" };

test("the demo account signs in and out, and can't be changed", async ({ page, browser }) => {
  await allowSignUp(browser, DEMO.email);
  // a retry finds the account already made; either way it exists afterwards
  await page.request.post("/api/auth/sign-up/email", { data: DEMO });
  await page.context().clearCookies();

  await page.goto("/signin");
  await page.getByLabel("Email").fill(DEMO.email);
  await page.getByLabel("Password").fill(DEMO.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/home$/);
  await expect(page.getByRole("heading", { name: "Welcome, Demo." })).toBeVisible();

  // the sign-in library's own endpoints, called from the signed-in page as a student could from the browser console
  const requests = [
    ["change-password", { currentPassword: DEMO.password, newPassword: "locked everyone out" }],
    ["change-email", { newEmail: "mine-now@example.com" }],
    ["update-user", { name: "Not the demo" }],
    ["delete-user", { password: DEMO.password }],
  ] as const;
  for (const [path, data] of requests) {
    const res = await page.evaluate(async ([p, d]) => {
      const r = await fetch(`/api/auth/${p}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(d) });
      return { status: r.status, body: await r.json() };
    }, [path, data] as const);
    expect(res.status, path).toBe(403);
    expect(res.body, path).toMatchObject({ message: "The demo account can't be changed." });
  }

  await page.reload();
  await expect(page.getByRole("heading", { name: "Welcome, Demo." })).toBeVisible();
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/signin$/);

  // the password still works
  await page.getByLabel("Email").fill(DEMO.email);
  await page.getByLabel("Password").fill(DEMO.password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/home$/);
});
