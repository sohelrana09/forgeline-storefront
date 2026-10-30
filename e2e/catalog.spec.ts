import { expect, test } from "@playwright/test";

// A guest browsing the catalog: home → category → product, search, and a real 404.

test("home page shows the banner, featured products and the guest welcome", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Welcome to Ironline Supply")).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
  await expect(page.getByRole("heading", { name: "Featured products" })).toBeVisible();
});

test("category leads to a product page with a price and stock", async ({ page }) => {
  await page.goto("/excavators");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Excavators");
  const firstProduct = page.locator("main article a").first();
  const href = await firstProduct.getAttribute("href");
  expect(href).toMatch(/^\/[a-z0-9-]+$/);
  await firstProduct.click();
  await expect(page).toHaveURL(new RegExp(`${href}$`));
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
  const response = await page.goto("/no-such-product");
  expect(response?.status()).toBe(404);
});

test("old and misspelled URLs redirect permanently to the clean one, keeping the query", async ({ page, request }) => {
  for (const [from, to] of [
    ["/c/excavators", "/excavators"],
    ["/c/wheeled_excavators?mobility=tracked", "/excavators/wheeled-excavators?mobility=tracked"],
    ["/p/jj234-wx?sku=jj234-wx-2019", "/jj234-wx?sku=jj234-wx-2019"],
    ["/pages/delivery-information", "/delivery-information"],
    ["/Excavators/Wheeled-Excavators", "/excavators/wheeled-excavators"],
  ]) {
    const response = await request.get(from, { maxRedirects: 0 });
    expect(response.status(), from).toBe(308);
    expect(response.headers().location, from).toBe(to);
  }
  await page.goto("/c/wheeled_excavators");
  await expect(page).toHaveURL(/\/excavators\/wheeled-excavators$/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Wheeled");
});

// Links to old URLs (a CMS link to /pages/delivery-information) once made the router prefetch them hundreds of times a
// second after a client-side navigation, because the proxy answered its prefetch with an HTTP redirect.
test("a page opened from a category doesn't keep prefetching its links", async ({ page }) => {
  await page.goto("/spare-parts");
  await page.locator("main article a").first().click();
  await expect(page.getByText(/SKU /)).toBeVisible();
  await page.waitForTimeout(1000);
  let routerRequests = 0;
  page.on("request", (r) => {
    if (r.headers()["rsc"]) routerRequests++;
  });
  await page.waitForTimeout(3000);
  expect(routerRequests).toBeLessThan(10);
});
