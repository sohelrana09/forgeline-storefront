import { defineConfig, devices } from "@playwright/test";

// Browser tests of the storefront. Locally they reuse the dev server on :3000 or start it; set E2E_BASE_URL to test a
// deployment instead.
// - chromium: as a guest, read-only (they create no carts or orders in commercetools).
// - signed-in: as the demo company's buyer, approver and admin (e2e/signed-in). They change only what they create
//   and put it back (a cart line, a company list). They run when a password is known: E2E_PASSWORD, or the demo
//   password from the git-ignored .env.demo that `npm run ct:seed-associates` sets on those accounts.
// - orders: opt-in with E2E_ORDERS=1 (e2e/orders). They place real orders in the shared project (guest and consumer
//   bank transfer, business invoice and approval) and cancel them and give the stock back afterwards; the card test
//   stubs Checkout out. Bank-transfer tests need the server with B2C_CARD_PAYMENTS=false, the card test the default.
const baseURL = process.env.E2E_BASE_URL ?? "http://localhost:3000";

try {
  process.loadEnvFile(".env.demo");
} catch {
  // No demo file: the signed-in tests are skipped.
}
const E2E_PASSWORD = process.env.E2E_PASSWORD ?? process.env.DEMO_BUYER_PASSWORD;
const E2E_ORDERS = process.env.E2E_ORDERS === "1";

const desktop = devices["Desktop Chrome"];

export default defineConfig({
  testDir: "e2e",
  timeout: 60_000, // the dev server compiles pages on first visit
  expect: { timeout: 15_000 },
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: { baseURL, trace: "retain-on-failure" },
  projects: [
    { name: "chromium", testIgnore: ["signed-in/**", "orders/**"], use: desktop },
    ...(E2E_PASSWORD
      ? [
          { name: "sign-in", testMatch: "signed-in/auth.setup.ts", use: desktop },
          { name: "signed-in", testMatch: "signed-in/*.spec.ts", dependencies: ["sign-in"], use: desktop },
        ]
      : []),
    ...(E2E_ORDERS
      ? [{ name: "orders", testMatch: "orders/*.spec.ts", dependencies: E2E_PASSWORD ? ["sign-in"] : [], workers: 1, use: desktop }]
      : []),
  ],
  webServer: process.env.E2E_BASE_URL ? undefined : { command: "npm run dev", url: baseURL, reuseExistingServer: true, timeout: 120_000 },
});
