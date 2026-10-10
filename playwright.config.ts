import { defineConfig, devices } from "@playwright/test";
import { e2ePort } from "./e2e/port";

// End-to-end tests start their own dev server on this copy's own port (e2e/port.ts) with an empty built-in database
// in .data/e2e, so a run here never meets another coder's server or data. Browsers: `npx playwright install chromium`
// once before the first local run; CI installs them itself.
const port = e2ePort(process.cwd());
const baseURL = `http://localhost:${port}`;

export default defineConfig({
  testDir: "./e2e",
  // One worker and generous waits: the dev server builds each page on its first visit, which can take far longer than
  // Playwright's 5-second default, and parallel workers make several pages build at once. Found in the course's dry run.
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  timeout: 120_000,
  expect: { timeout: 20_000 },

  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    actionTimeout: 20_000,
    navigationTimeout: 60_000,
  },

  // The first account is the owner (B6), so `setup` signs the owner up before anything else; other tests ask the
  // owner to allow their emails (e2e/owner.ts).
  projects: [
    { name: "setup", testMatch: /owner\.setup\.ts/, use: { ...devices["Desktop Chrome"] } },
    { name: "chromium", use: { ...devices["Desktop Chrome"] }, dependencies: ["setup"] },
  ],

  webServer: {
    command: "npm run e2e:server",
    url: baseURL,
    env: { PORT: String(port), GUILDHALL_DATA_DIR: ".data/e2e" },
    reuseExistingServer: false,
    timeout: 180_000,
  },
});
