import { expect, test } from "@playwright/test";
import { stateFile } from "./accounts";

// Purchase order to cart (AI_PO_TO_CART with ANTHROPIC_API_KEY on the server; skipped otherwise). Signed in as the
// demo company's buyer. Read-only: Claude fills the quick-order box, and the test never presses "Add all to cart".
// Each run is one paid model request.
test.use({ storageState: stateFile("buyer") });

test("reads a pasted purchase order into the quick-order box", async ({ page }) => {
  await page.goto("/quick-order");
  const panel = page.locator("summary", { hasText: "Read a purchase order" });
  test.skip(!(await panel.isVisible()), "AI_PO_TO_CART is off on this server");

  await panel.click();
  await page
    .getByLabel("Or paste its text")
    .fill(
      [
        "PURCHASE ORDER PO-4471",
        "Line 1  air-filter   Air filter, engine   Qty 4",
        "Line 2  NOPE-999   Unknown widget   Qty 2",
        "Freight  25.00",
      ].join("\n"),
    );
  await page.getByRole("button", { name: "Read order lines" }).click();

  await expect(page.getByText(/Read 2 lines into the order lines/)).toBeVisible({ timeout: 90_000 });
  await expect(page.locator("#qo-lines")).toHaveValue(/air-filter, 4/);
  await expect(page.locator("#qo-lines")).toHaveValue(/NOPE-999, 2/);
  await expect(page.getByText(/Not sold here: NOPE-999/)).toBeVisible();
});
