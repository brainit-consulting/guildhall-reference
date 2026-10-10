import { defineConfig, devices } from "@playwright/test";
import { e2ePort } from "./e2e/port";

// End-to-end tests start their own dev server on this copy's own port (e2e/port.ts) with an empty built-in database
// in .data/e2e, so a run here never meets another coder's server or data. Browsers: `npx playwright install chromium`
// once before the first local run; CI installs them itself.
const port = e2ePort(process.cwd());
const baseURL = `http://localhost:${port}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",

  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },

  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],

  webServer: {
    command: "npm run e2e:server",
    url: baseURL,
    env: { PORT: String(port), GUILDHALL_DATA_DIR: ".data/e2e" },
    reuseExistingServer: false,
    timeout: 180_000,
  },
});
