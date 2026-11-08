import { expect, test, type Page } from "@playwright/test";

// Analytics data layer (docs/features/analytics-datalayer.md), read-only: list, product and search pages push GA4
// e-commerce events to window.dataLayer, with prices and without personal data. No cart is created.
const events = (page: Page, name: string) =>
  page.evaluate((n) => ((window as unknown as { dataLayer?: { event?: string }[] }).dataLayer ?? []).filter((e) => e?.event === n), name);

test("a category page sends view_item_list with positions and prices", async ({ page }) => {
  await page.goto("/spare-parts");
  await expect.poll(async () => (await events(page, "view_item_list")).length).toBeGreaterThan(0);
  const [list] = (await events(page, "view_item_list")) as {
    ecommerce: { item_list_id: string; currency: string; items: { index: number; price: number }[] };
  }[];
  expect(list.ecommerce.item_list_id).toBe("spare-parts");
  expect(list.ecommerce.currency).toMatch(/^[A-Z]{3}$/);
  expect(list.ecommerce.items[0].index).toBe(0);
  expect(list.ecommerce.items[0].price).toBeGreaterThan(0);
});

test("a product page sends view_item", async ({ page }) => {
  await page.goto("/air-filter");
  await expect.poll(async () => (await events(page, "view_item")).length).toBe(1);
  const [item] = (await events(page, "view_item")) as { ecommerce: { value: number; items: { item_id: string }[] } }[];
  expect(item.ecommerce.items[0].item_id).toBeTruthy();
  expect(item.ecommerce.value).toBeGreaterThan(0);
});

test("search sends the term without an email address in it", async ({ page }) => {
  await page.goto(`/search?q=${encodeURIComponent("filter me@example.com")}`);
  await expect.poll(async () => (await events(page, "search")).length).toBe(1);
  const [search] = (await events(page, "search")) as { search_term: string }[];
  expect(search.search_term).not.toContain("@");
});
