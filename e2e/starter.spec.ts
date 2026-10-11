import { expect, test } from "@playwright/test";
import { BUSINESS_NAME } from "../src/lib/brand";
import { allowSignUp } from "./owner";

test("the welcome page shows", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: BUSINESS_NAME, level: 1 })).toBeVisible();
});

test("sign-up and sign-in work on the built-in database, on this copy's own port", async ({ request, baseURL, browser }) => {
  const email = `e2e-${Date.now()}@example.com`;
  await allowSignUp(browser, email);
  const headers = { origin: baseURL! }; // as a browser on this page would send
  const up = await request.post("/api/auth/sign-up/email", { headers, data: { name: "E2E", email, password: "correct horse" } });
  expect(up.status()).toBe(200);
  const inRes = await request.post("/api/auth/sign-in/email", { headers, data: { email, password: "correct horse" } });
  expect(inRes.status()).toBe(200);
});

test("sign-up works from any local address, not only the one in PORT", async ({ request, browser }) => {
  // a coder may start the dev server with `-p` or open it as 127.0.0.1
  for (const origin of ["http://localhost:3999", "http://127.0.0.1:3999"]) {
    const email = `e2e-${Date.now()}-${origin.length}@example.com`;
    await allowSignUp(browser, email);
    const up = await request.post("/api/auth/sign-up/email", { headers: { origin }, data: { name: "E2E", email, password: "correct horse" } });
    expect(up.status(), origin).toBe(200);
  }
});
