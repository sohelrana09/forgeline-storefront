import { expect, test, type Page } from "@playwright/test";

// Shared steps for the order tests (opt-in: E2E_ORDERS=1, see playwright.config.ts).

export const PART = { slug: "/fuel-filter", name: "Fuel Filter" };
export const ORDER_NUMBER = /[A-Z0-9]{1,8}-\d{4}-\d{6}/;
export const ORDER_URL = /\/(account\/orders|order-confirmation)\/([0-9a-f-]{36})/;

// A marker that lets anyone find test data in the shared project (PO number, guest e-mail).
export const marker = () => `E2E-${Date.now()}`;

export const orderIdFrom = (url: string) => url.match(ORDER_URL)?.[2] ?? "";

// The quantity of a product in the cart, 0 when it isn't there.
export async function cartQuantity(page: Page, name: string) {
  await page.goto("/cart");
  const input = page.getByRole("region", { name: "Cart lines" }).getByLabel(`quantity for ${name}`, { exact: true });
  return (await input.count()) ? Number(await input.inputValue()) : 0;
}

export async function cartIsEmpty(page: Page) {
  await page.goto("/cart");
  return (await page.getByRole("region", { name: "Cart lines" }).count()) === 0;
}

export async function addToCart(page: Page, product = PART, quantity = 1) {
  await page.goto(product.slug);
  await page.getByRole("button", { name: "Add to cart" }).first().click();
  await expect(page.getByText(`You added ${product.name} to your shopping cart.`)).toBeVisible();
  if (quantity > 1) {
    await page.goto("/cart");
    const lines = page.getByRole("region", { name: "Cart lines" });
    await lines.getByLabel(`quantity for ${product.name}`, { exact: true }).fill(String(quantity));
    await lines.getByRole("button", { name: "Update" }).first().click();
    await expect(lines.getByLabel(`quantity for ${product.name}`, { exact: true })).toHaveValue(String(quantity));
  }
}

export async function removeFromCart(page: Page, product = PART) {
  await page.goto("/cart");
  const remove = page.getByRole("region", { name: "Cart lines" }).getByRole("button", { name: `Remove ${product.name}` });
  if (await remove.count()) {
    page.once("dialog", (d) => d.accept());
    await remove.click();
    await expect(page.getByText(`You removed ${product.name} from your shopping cart.`)).toBeVisible();
  }
}

// Which payment the checkout offers this customer: the server decides (B2C_CARD_PAYMENTS). Step 3 shows its button
// only once the delivery details are saved, so call this after that.
export const PAY_BUTTON = /^Pay by card$/;

export async function offersCard(page: Page) {
  const card = page.getByRole("button", { name: PAY_BUTTON });
  await expect(card.or(page.getByRole("button", { name: "Place order" }))).toBeVisible();
  return card.isVisible();
}

// Guest checkout steps 1 and 2. The form refuses submissions faster than 1.5 s after it rendered (bot check).
export async function fillGuestDetails(page: Page, email: string) {
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("First name").fill("Test");
  await page.getByLabel("Last name").fill("Tester");
  await page.getByLabel("Street").fill("Calle Mayor");
  await page.getByLabel("Number", { exact: true }).fill("1");
  await page.getByLabel("Postcode").fill("28013");
  await page.getByLabel("City").fill("Madrid");
  await page.getByLabel("Country").selectOption("ES");
  // The first method (rates are listed for the first country until the address is saved; it also ships to Spain).
  await page.waitForTimeout(1700);
  await page.getByRole("radio").first().check();
  await page.getByRole("button", { name: "Save shipping details" }).click();
  await expect(page.getByText("Saved. Check the order summary, then place your order below.")).toBeVisible();
}

// Signed-in checkout steps 1 and 2: the saved choices, or the first address and method. Each choice saves on change.
export async function chooseDelivery(page: Page) {
  await expect(page.getByRole("heading", { name: "Shipping address" })).toBeVisible();
  const addresses = page.getByRole("group", { name: "Ship to" }).getByRole("radio");
  if (!(await addresses.count())) return false;
  if (!(await addresses.first().isChecked()) && !(await page.locator('input[name="addressId"]:checked').count())) {
    await addresses.first().check();
    await expect(page.getByText("Saving your choice and updating the total…")).toBeHidden();
  }
  const methods = page.getByRole("group", { name: "Shipping method" }).getByRole("radio");
  if (!(await page.locator('input[name="shippingMethodKey"]:checked').count())) {
    await methods.first().check();
    await expect(page.getByText("Saving your choice and updating the total…")).toBeHidden();
  }
  return true;
}

export async function placeOrder(page: Page) {
  const button = page.getByRole("button", { name: "Place order" });
  await expect(button).toBeEnabled();
  await button.click();
  await page.waitForURL(ORDER_URL);
  return orderIdFrom(page.url());
}

// Points the browser at a cart the test created (cleanup.ts createTestCart): the storefront keeps the cart id per
// business unit in this cookie and checks with the customer's own token that the cart is theirs.
export async function useCart(page: Page, unitKey: string, cartId: string) {
  const url = test.info().project.use.baseURL ?? "http://localhost:3000";
  await page.context().addCookies([{ name: `ct_cart_${unitKey}`, value: cartId, url, httpOnly: true, sameSite: "Lax" }]);
}

// The signed-in visitor's cart lines (SKU and quantity), from the minicart endpoint.
export async function cartLines(page: Page): Promise<{ sku: string; quantity: number }[]> {
  const res = await page.request.get("/api/cart-summary");
  expect(res.ok()).toBe(true);
  const { lines } = (await res.json()) as { lines: { sku: string; quantity: number }[] };
  return lines.map(({ sku, quantity }) => ({ sku, quantity }));
}
