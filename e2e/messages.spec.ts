import { expect, test } from "@playwright/test";

// Magento-style page messages, without touching the shared project: a message recorded in the ct_messages cookie
// (as a Server Action would) shows at the top of the page, can be dismissed, and is shown only once.
test("a recorded message shows once at the top of the page and can be dismissed", async ({ page, context, baseURL }) => {
  const message = JSON.stringify([{ type: "success", text: "You added Air Filter to your shopping cart." }]);
  await context.addCookies([{ name: "ct_messages", value: encodeURIComponent(message), url: baseURL! }]);
  await page.goto("/spare-parts");
  const shown = page.getByRole("status").filter({ hasText: "You added Air Filter to your shopping cart." });
  await expect(shown).toBeVisible();
  await shown.getByRole("button", { name: "Dismiss message" }).click();
  await expect(shown).toBeHidden();
  await page.reload();
  await expect(page.getByText("You added Air Filter to your shopping cart.")).toBeHidden();
});
