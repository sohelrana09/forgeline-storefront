import { expect, test } from "@playwright/test";

// Category table view (docs/features/plp-table-view.md), read-only: the toggle switches to rows (?view=table) and back.
test("the category page switches to a table and back", async ({ page }) => {
  await page.goto("/spare-parts");
  await page.getByRole("link", { name: "View as Table" }).click();
  await expect(page).toHaveURL(/view=table/);
  const table = page.getByRole("table", { name: "Products" });
  await expect(table.getByRole("rowheader", { name: /Air Filter/ })).toBeVisible();
  await expect(page.getByRole("link", { name: "View as Table" })).toHaveAttribute("aria-current", "true");

  await page.getByRole("link", { name: "View as Grid" }).click();
  await expect(page).not.toHaveURL(/view=table/);
  await expect(page.getByRole("table", { name: "Products" })).toHaveCount(0);
});
