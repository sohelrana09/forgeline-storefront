import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";

// PunchOut (docs/features/punchout.md), read-only: needs a server with PUNCHOUT=true (E2E_PUNCHOUT=1 to run). Nothing
// here can open a session (no connection matches the fixture's secret on its own), so no cart is created.
test.skip(!process.env.E2E_PUNCHOUT, "set E2E_PUNCHOUT=1 against a server with PUNCHOUT=true");

const fixture = (name: string) => readFileSync(join(__dirname, "../src/features/punchout/fixtures", name), "utf8");
const post = (request: import("@playwright/test").APIRequestContext, body: string) =>
  request.post("/api/punchout/setup", { data: body, headers: { "Content-Type": "text/xml" } });

test("a setup request with an unknown identity or wrong secret is refused in cXML", async ({ request }) => {
  const res = await post(request, fixture("setup-request.xml").replace("LIFTTECH-ES", "NO-SUCH-BUYER"));
  expect(res.status()).toBe(401);
  expect(res.headers()["content-type"]).toContain("text/xml");
  expect(await res.text()).toContain('<Status code="401"');
});

test("XXE and entity expansion are refused before anything is looked up", async ({ request }) => {
  for (const name of ["xxe.xml", "billion-laughs.xml", "undeclared-entity.xml"]) {
    const res = await post(request, fixture(name));
    expect(res.status(), name).toBe(400);
  }
});

test("an unknown start token and the return page without a session go nowhere", async ({ page, request }) => {
  expect((await request.get("/api/punchout/start?token=" + "a".repeat(43))).status()).toBe(410);
  await page.goto("/punchout");
  await expect(page.getByText("Your PunchOut session has ended")).toBeVisible();
  const ret = await request.post("/api/punchout/return", { headers: { Origin: "https://evil.example" } });
  expect(ret.status()).toBe(403);
});
