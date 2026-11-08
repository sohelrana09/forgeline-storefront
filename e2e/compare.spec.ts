import { expect, test } from "@playwright/test";

// Spec sheets, downloads and compare (docs/features/product-specs-downloads-compare.md): read-only guest flows. The
// compare list lives in the browser's own storage, so nothing is written to the project.
test("a product page offers the spec sheet, and two ticked products open side by side", async ({ page, request }) => {
  await page.goto("/s567-uv?sku=s567-uv-2015");
  const downloads = page.locator('section[aria-labelledby="downloads"]');
  const sheet = downloads.getByRole("link", { name: "Spec sheet (PDF)" });
  await expect(sheet).toBeVisible();
  const pdf = await request.get((await sheet.getAttribute("href"))!);
  expect(pdf.headers()["content-type"]).toBe("application/pdf");

  await downloads.getByLabel("Compare").check();
  await page.goto("/a789-bc?sku=a789-bc-2015");
  await page.locator('section[aria-labelledby="downloads"]').getByLabel("Compare").check();
  await page.getByRole("link", { name: "Compare 2 of 4" }).click();

  await expect(page).toHaveURL(/\/compare\?skus=s567-uv-2015,a789-bc-2015/);
  await expect(page.getByRole("columnheader", { name: /S567 UV/ })).toBeVisible();
  await expect(page.getByRole("rowheader", { name: /Mobility/ })).toBeVisible();
});

test("an unknown SKU has no spec sheet", async ({ request }) => {
  expect((await request.get("/api/spec-sheet/no-such-sku")).status()).toBe(404);
});
