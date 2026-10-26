import { defineConfig, devices } from "@playwright/test";

// Browser tests of the storefront as a guest (read-only: they create no carts or orders in commercetools).
// Locally they reuse the dev server on :3000 or start it; set E2E_BASE_URL to test a deployment instead.
const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3000";

export default defineConfig({
  testDir: "e2e",
  timeout: 60_000, // the dev server compiles pages on first visit
  expect: { timeout: 15_000 },
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: { baseURL, trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: process.env.E2E_BASE_URL ? undefined : { command: "npm run dev", url: baseURL, reuseExistingServer: true, timeout: 120_000 },
});
