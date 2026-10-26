import { expect, test } from "@playwright/test";

// The Magento-style minicart, as a guest with an empty cart (read-only: nothing is added).

test("the cart icon opens the minicart and Esc closes it", async ({ page }) => {
  await page.goto("/");
  const toggle = page.getByRole("link", { name: /^Cart, 0 items/ });
  await toggle.click();
  const panel = page.getByRole("dialog", { name: "Shopping cart" });
  await expect(panel).toBeVisible();
  await expect(panel).toContainText("You have no items in your shopping cart.");
  // Empty: just the message, as in Magento (checkout and "View and Edit Cart" only with products).
  await expect(panel.getByRole("link")).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(panel).toBeHidden();
  await expect(toggle).toBeFocused();
});

test("the minicart closes on a click outside", async ({ page }) => {
  await page.goto("/quick-order");
  await page.getByRole("link", { name: /^Cart, / }).click();
  const panel = page.getByRole("dialog", { name: "Shopping cart" });
  await expect(panel).toBeVisible();
  await page.locator("main").click({ position: { x: 10, y: 10 } });
  await expect(panel).toBeHidden();
});
