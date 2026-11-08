import { expect, test } from "@playwright/test";

// Fitment (docs/features/fitment.md), read-only guest flows on the sample data: the air filter is a relatedProduct of
// the S567 UV excavator, which lists five parts.
test("a part's page lists the machines it fits, and links to them", async ({ page }) => {
  await page.goto("/air-filter");
  const fits = page.locator('section[aria-labelledby="fits"]');
  await expect(fits.getByRole("heading", { name: "Fits" })).toBeVisible();
  await expect(fits.getByRole("link").first()).toBeVisible();
});

test("?fits= narrows a category to the parts that fit that machine", async ({ page }) => {
  await page.goto("/spare-parts?fits=s567-uv");
  await expect(page.getByText(/S567 UV/).first()).toBeVisible();
  await expect(page.getByText("5 items")).toBeVisible();
  await expect(page.getByRole("link", { name: /Air Filter/ }).first()).toBeVisible();
});
