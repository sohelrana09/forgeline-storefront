import { expect, test } from "@playwright/test";

// A guest browsing the catalog: home → category → product, search, and a real 404.

test("home page shows the banner, featured products and the guest welcome", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Welcome to Ironline Supply")).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "Featured products" })).toBeVisible();
});

test("category leads to a product page with a price and stock", async ({ page }) => {
  await page.goto("/c/excavators");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Excavators");
  const firstProduct = page.locator('main a[href^="/p/"]').first();
  await firstProduct.click();
  await expect(page).toHaveURL(/\/p\//);
  await expect(page.getByText(/SKU /)).toBeVisible();
  await expect(page.getByText(/€|\$|£/).first()).toBeVisible();
});

test("search finds products by name", async ({ page }) => {
  await page.goto("/search?q=filter");
  await expect(page.getByText("Air Filter").first()).toBeVisible();
});

test("search autocomplete suggests while typing", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("combobox", { name: /search/i }).fill("filt");
  await expect(page.getByRole("option").first()).toBeVisible();
});

test("an unknown product is a real 404", async ({ page }) => {
  const response = await page.goto("/p/no-such-product");
  expect(response?.status()).toBe(404);
});
