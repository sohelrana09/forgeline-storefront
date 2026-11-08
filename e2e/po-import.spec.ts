import { expect, test } from "@playwright/test";

// Guests never see "Read a purchase order" (each read is a paid model request; signed-in buyers only).
test("guests don't get the purchase order reader", async ({ page }) => {
  await page.goto("/quick-order");
  await expect(page.locator("#qo-lines")).toBeVisible();
  await expect(page.getByText("Read a purchase order")).toHaveCount(0);
});
