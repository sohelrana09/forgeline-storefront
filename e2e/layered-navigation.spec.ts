import { expect, test } from "@playwright/test";

// Magento-style layered navigation on a category page, as a guest (read-only).

test("filter, sort and remove a filter without a full page load", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/excavators");
  const shopBy = page.getByRole("complementary", { name: "Shop by" });
  await expect(shopBy.getByText("Mobility")).toBeVisible();
  // A marker on window survives in-place updates but not a full page load.
  await page.evaluate(() => ((window as unknown as { marker: string }).marker = "same page"));

  await shopBy.locator('a[href*="mobility=tracked"]').click();
  await expect(page).toHaveURL(/mobility=tracked/);
  await expect(shopBy.getByText("Now Shopping by")).toBeVisible();
  await expect(shopBy.getByText("Tracked")).toBeVisible();

  await page.locator('select[name="sort"]').selectOption("price-asc");
  await expect(page).toHaveURL(/sort=price-asc/);

  await shopBy.getByRole("link", { name: /Remove Mobility/ }).click();
  await expect(page).not.toHaveURL(/mobility=/);
  await expect(page).toHaveURL(/sort=price-asc/);
  expect(await page.evaluate(() => (window as unknown as { marker?: string }).marker)).toBe("same page");
});

test("on phones the filters open from a Shop By button", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto("/spare-parts");
  const toggle = page.getByRole("button", { name: /Shop By/ });
  const filters = page.locator("#shop-by-filters");
  await expect(filters).toBeHidden();
  await toggle.click();
  await expect(filters).toBeVisible();
  await expect(filters.getByText("Price")).toBeVisible();
});
