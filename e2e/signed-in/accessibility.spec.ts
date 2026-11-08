import { test } from "@playwright/test";
import { expectAccessible } from "../support/axe";
import { stateFile } from "./accounts";

// Accessibility (WCAG 2.1 AA, axe-core) of the account and company pages, signed in as the demo company's admin
// (who sees every company page). Read-only: nothing is submitted. Pages of features that are off answer 404, which
// is checked too.
test.use({ storageState: stateFile("admin") });

const PAGES: [string, string][] = [
  ["account", "/account"],
  ["orders", "/account/orders"],
  ["company orders", "/account/orders?scope=company"],
  ["quotes", "/account/quotes"],
  ["purchase lists", "/account/purchase-lists"],
  ["addresses", "/account/addresses"],
  ["account information", "/account/information"],
  ["approvals", "/account/approvals"],
  ["company profile", "/account/company"],
  ["company users", "/account/company/users"],
  ["approval rules", "/account/company/approval-rules"],
  ["my equipment", "/account/company/equipment"],
  ["budgets", "/account/company/budgets"],
  ["recurring orders", "/account/recurring-orders"],
  ["shared carts", "/account/shared-carts"],
  ["cart", "/cart"],
];

for (const [name, path] of PAGES) {
  test(`${name} has no WCAG 2.1 AA violations`, async ({ page }) => {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    await expectAccessible(page);
  });
}
