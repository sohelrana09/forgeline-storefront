import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { cartIdsOf, cleanupProblem, customerIdByEmail, deleteTestCart } from "./cleanup";
import { ACCOUNTS } from "../signed-in/accounts";

// PunchOut round trip (docs/features/punchout.md) against a server with PUNCHOUT=true and a test connection for the
// buyer's unit: `ct:punchout -- --unit lifttech-solutions-ltd-es --customer <buyer> --identity <id> --return-host
// procurement.example.com --yes` with PUNCHOUT_SHARED_SECRET set. Give the test the same identity and secret:
// E2E_PUNCHOUT_IDENTITY, E2E_PUNCHOUT_SECRET. The setup request opens a session with a fresh cart, the browser adds a
// part and returns the cart; the return form is checked, never submitted. The cart the session created is deleted.
const identity = process.env.E2E_PUNCHOUT_IDENTITY;
const secret = process.env.E2E_PUNCHOUT_SECRET;
const UNIT = "lifttech-solutions-ltd-es";

test.beforeAll(async () => {
  const problem = await cleanupProblem();
  test.skip(!!problem, `Order tests can't clean up: ${problem}`);
});
test.skip(!identity || !secret, "set E2E_PUNCHOUT_IDENTITY and E2E_PUNCHOUT_SECRET for a test connection");

const xmlText = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

test("cXML setup, shopping in the PunchOut cart, and the cart returned to the procurement system", async ({ page, request }) => {
  const customerId = await customerIdByEmail(ACCOUNTS.buyer);
  const before = new Set(await cartIdsOf(customerId, UNIT));
  try {
    const body = readFileSync(join(__dirname, "../../src/features/punchout/fixtures/setup-request.xml"), "utf8")
      .replaceAll("LIFTTECH-ES", xmlText(identity!))
      .replace("correct horse battery staple", xmlText(secret!));
    const res = await request.post("/api/punchout/setup", { data: body, headers: { "Content-Type": "text/xml" } });
    const xml = await res.text();
    expect(res.status(), xml).toBe(200);
    expect(xml).toContain('<Status code="200"');
    const start = xml.match(/<StartPage>\s*<URL>([^<]+)<\/URL>/)?.[1]?.replace(/&amp;/g, "&");
    expect(start).toBeTruthy();

    await page.goto(start!);
    await expect(page).toHaveURL(/\/punchout$/);
    await page.getByLabel("Add by SKU").fill("air-filter, 2");
    await page.getByRole("button", { name: "Add to cart" }).click();
    await expect(page.getByText(/Air Filter/).first()).toBeVisible();

    // The token worked once: a second start answers 410.
    expect((await request.get(start!)).status()).toBe(410);

    await page.getByRole("button", { name: "Return cart to procurement.example.com" }).click();
    await expect(page.getByRole("heading", { name: "Return your cart" })).toBeVisible();
    const form = page.locator('form[action^="https://procurement.example.com/punchout/return"]');
    await expect(form).toHaveCount(1);
    const values = await form.locator("input[type=hidden]").evaluateAll((els) => els.map((e) => (e as HTMLInputElement).value).join("\n"));
    expect(values).toContain("PunchOutOrderMessage");
    expect(values).toContain("air-filter");
    expect(values).toContain("34234234ADFSDF234234"); // the buyer cookie goes back
  } finally {
    for (const id of await cartIdsOf(customerId, UNIT)) if (!before.has(id)) await deleteTestCart(id);
  }
});
