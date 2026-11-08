import { test } from "@playwright/test";
import { expectAccessible } from "./support/axe";

// Accessibility (WCAG 2.1 AA, axe-core) of the guest pages, read-only. Signed-in pages: e2e/signed-in/accessibility.spec.ts.
const PAGES: [string, string][] = [
  ["home", "/"],
  ["category", "/spare-parts"],
  ["category as a table", "/spare-parts?view=table"],
  ["filtered category", "/spare-parts?fits=s567-uv"],
  ["machine category", "/excavators"],
  ["product", "/air-filter"],
  ["machine product", "/s567-uv"],
  ["search", "/search?q=filter"],
  ["compare", "/compare?skus=air-filter,starter-motor"],
  ["quick order", "/quick-order"],
  ["cart (empty)", "/cart"],
  ["sign in", "/login"],
  ["create an account", "/register"],
  ["forgot password", "/forgot-password"],
  ["not found", "/no-such-page-here"],
];

for (const [name, path] of PAGES) {
  test(`${name} has no WCAG 2.1 AA violations`, async ({ page }) => {
    await page.goto(path);
    // Streamed parts (prices, the cart, carousels) are in before the check.
    await page.waitForLoadState("networkidle");
    await expectAccessible(page);
  });
}
