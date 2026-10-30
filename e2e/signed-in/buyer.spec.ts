import { expect, test, type Download, type Page } from "@playwright/test";
import { stateFile } from "./accounts";

// As the demo company's buyer (Sofía López, LiftTech Soluciones S.L., Spain). Anything a test creates (a cart line, a
// company list) it removes again, so the shared project keeps its state.

test.use({ storageState: stateFile("buyer") });

const PART = { slug: "/fuel-filter", name: "Fuel Filter" };

async function body(download: Download) {
  const chunks: Buffer[] = [];
  for await (const chunk of await download.createReadStream()) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks);
}

// The quantity of a product in the cart, 0 when it isn't there.
async function cartQuantity(page: Page, name: string) {
  await page.goto("/cart");
  const input = page.getByRole("region", { name: "Cart lines" }).getByLabel(`quantity for ${name}`, { exact: true });
  return (await input.count()) ? Number(await input.inputValue()) : 0;
}

test("the account page shows the company and recent orders", async ({ page }) => {
  await page.goto("/account");
  await expect(page.getByRole("heading", { level: 1, name: "My account" })).toBeVisible();
  await expect(page.getByRole("main")).toContainText("LiftTech Soluciones S.L.");
  await expect(page.getByRole("heading", { name: "Recent orders" })).toBeVisible();
  // Recent orders moved off the home page.
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Recent orders" })).toHaveCount(0);
});

test("adding to the cart and taking it out again", async ({ page }) => {
  const before = await cartQuantity(page, PART.name);
  await page.goto(PART.slug);
  // The product's own button comes first; the carousels below have more.
  await page.getByRole("button", { name: "Add to cart" }).first().click();
  await expect(page.getByText(`You added ${PART.name} to your shopping cart.`)).toBeVisible();
  expect(await cartQuantity(page, PART.name)).toBe(before + 1);

  // Put the cart back as it was.
  const lines = page.getByRole("region", { name: "Cart lines" });
  if (before === 0) {
    await lines.getByRole("button", { name: `Remove ${PART.name}` }).click();
    await expect(page.getByText(`You removed ${PART.name} from your shopping cart.`)).toBeVisible();
  } else {
    await lines.getByLabel(`quantity for ${PART.name}`, { exact: true }).fill(String(before));
    await lines.getByRole("button", { name: "Update" }).first().click();
  }
  expect(await cartQuantity(page, PART.name)).toBe(before);
});

test("a company list: create, add a product, delete", async ({ page }) => {
  const name = `E2E list ${Date.now()}`;
  await page.goto("/account/purchase-lists");
  await page.getByLabel("New company list name").fill(name);
  await page.getByRole("button", { name: "Create company list" }).click();
  await page.waitForURL(/\/account\/purchase-lists\/[0-9a-f-]{36}\?scope=company$/);
  const listUrl = page.url();
  try {
    await expect(page.getByText("Company list, created by Sofía López.")).toBeVisible();

    await page.goto("/air-filter");
    await page.getByText("Add to purchase list", { exact: true }).first().click(); // opens the panel
    await page.getByLabel("Purchase list").selectOption({ label: `${name} (company)` });
    await page.getByLabel("Quantity", { exact: true }).fill("2");
    await page.getByRole("button", { name: "Add to purchase list" }).click();
    await expect(page.getByText(`Added 1 product to "${name}"`)).toBeVisible();

    await page.goto(listUrl);
    await expect(page.getByText("1 product, 2 items")).toBeVisible();
    await expect(page.getByRole("main")).toContainText("Air Filter");
  } finally {
    // Delete it even when a step above failed.
    await page.goto(listUrl);
    await page.getByRole("button", { name: "Delete list" }).click();
    await page.getByRole("button", { name: "Yes, delete" }).click();
    await page.waitForURL(/\/account\/purchase-lists\?deleted=1$/);
  }
  // Visible text only: Next keeps recently visited pages (here the deleted list's own page) hidden in the DOM.
  await expect(page.getByRole("main").getByText(name).filter({ visible: true })).toHaveCount(0);
});

test("order documents: CSV export, order confirmation and invoice", async ({ page }) => {
  await page.goto("/account/orders");
  const [csv] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("link", { name: "Download Export orders (CSV)" }).click(),
  ]);
  expect(csv.suggestedFilename()).toMatch(/^my-orders-\d{4}-\d{2}-\d{2}\.csv$/);
  expect((await body(csv)).toString("utf8")).toMatch(/^﻿Order,Date,Purchase order,Status,Items,Net,Tax,Total,Currency\r\n/);

  await page
    .getByRole("link", { name: /^View order / })
    .first()
    .click();
  await page.waitForURL(/\/account\/orders\/[0-9a-f-]{36}$/);
  const [confirmation] = await Promise.all([
    page.waitForEvent("download"),
    page.getByRole("link", { name: "Download Order confirmation (PDF)" }).click(),
  ]);
  expect(confirmation.suggestedFilename()).toMatch(/^order-confirmation-.+\.pdf$/);
  expect((await body(confirmation)).subarray(0, 5).toString()).toBe("%PDF-");

  // Only Confirmed or Complete orders have an invoice (the demo data keeps one confirmed order).
  const invoice = page.getByRole("link", { name: "Download Invoice (PDF)" });
  if (await invoice.count()) {
    const [file] = await Promise.all([page.waitForEvent("download"), invoice.click()]);
    expect(file.suggestedFilename()).toMatch(/^invoice-.+\.pdf$/);
    expect((await body(file)).subarray(0, 5).toString()).toBe("%PDF-");
  }
});

test("someone else's order and its documents are not found", async ({ page }) => {
  const id = "00000000-0000-4000-8000-000000000000";
  expect((await page.request.get(`/account/orders/${id}/pdf/confirmation`)).status()).toBe(404);
  await page.goto(`/account/orders/${id}`);
  await expect(page.getByRole("heading", { name: "We couldn't find that page" })).toBeVisible();
});
