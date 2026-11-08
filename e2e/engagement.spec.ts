import { expect, test } from "@playwright/test";

// B2C engagement (docs/features/b2c-engagement.md), read-only guest flows. Recently viewed lives in the browser's own
// storage; the free-shipping bar, reviews and stock alerts need a cart, a signed-in customer or a switch, and are
// covered by unit tests.
test("recently viewed lists the products seen in this browser, newest first, without the current one", async ({ page }) => {
  await page.goto("/air-filter");
  await expect(page.getByRole("heading", { name: "Air Filter", level: 1 })).toBeVisible();
  await page.goto("/fuel-filter");
  await expect(page.getByRole("heading", { name: "Fuel Filter", level: 1 })).toBeVisible();
  await page.goto("/alternator");

  const recent = page.locator('section[aria-labelledby="recently-viewed"]');
  await expect(recent.getByRole("link")).toHaveText(["Fuel Filter", "Air Filter"]);
  await expect(recent.getByRole("link", { name: "Alternator" })).toHaveCount(0);
});
