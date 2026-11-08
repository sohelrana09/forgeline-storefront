import { describe, expect, it } from "vitest";
import { demoEmails, demoEnabled, demoLocked, demoSignInEnabled, isDemoAccount, isDemoRole, planReset, summarizePlan } from "./demo";

const on = { DEMO_MODE: "true", DEMO_PASSWORD: "x" };

describe("demo switches", () => {
  it("is off unless DEMO_MODE is true, and the sign-in needs a password", () => {
    expect(demoEnabled({})).toBe(false);
    expect(demoEnabled({ DEMO_MODE: "1" })).toBe(false);
    expect(demoSignInEnabled({ DEMO_MODE: "true" })).toBe(false);
    expect(demoSignInEnabled(on)).toBe(true);
  });

  it("uses the sample data's people unless configured, lower-cased", () => {
    expect(demoEmails({}).buyer).toBe("sofia-lopez@ltsl.com");
    expect(demoEmails({ DEMO_ADMIN_EMAIL: " Admin@Example.com " }).admin).toBe("admin@example.com");
  });

  it("accepts only the three roles", () => {
    expect(isDemoRole("approver")).toBe(true);
    expect(isDemoRole("owner")).toBe(false);
    expect(isDemoRole(null)).toBe(false);
  });

  it("locks persona-changing actions for persona accounts only, and only in demo mode", () => {
    expect(isDemoAccount("SOFIA-LOPEZ@ltsl.com", on)).toBe(true);
    expect(demoLocked("carlos-garcia@ltsl.com", on)).toMatch(/shared demo account/);
    expect(demoLocked("someone@else.com", on)).toBeUndefined();
    expect(demoLocked("sofia-lopez@ltsl.com", {})).toBeUndefined();
    expect(demoLocked(undefined, on)).toBeUndefined();
  });
});

describe("planReset", () => {
  const r = (id: string) => ({ id, version: 3 });
  it("rejects approvals first, deletes quotes before what they came from, then the rest", () => {
    const steps = planReset({
      carts: [r("c1")],
      quotes: [r("q1")],
      stagedQuotes: [r("s1")],
      quoteRequests: [r("r1")],
      shoppingLists: [r("l1")],
      recurringOrders: [r("o1")],
      pendingApprovals: [{ ...r("a1"), unitKey: "u" }],
      budgets: [{ key: "u", version: 1 }],
    });
    expect(steps.map((s) => (s.kind === "delete" ? s.resource : s.kind))).toEqual([
      "reject-approval",
      "quote",
      "staged-quote",
      "quote-request",
      "recurring-order",
      "cart",
      "shopping-list",
      "delete-budget",
    ]);
    expect(steps[0]).toEqual({ kind: "reject-approval", id: "a1", version: 3, unitKey: "u" });
    expect(summarizePlan(steps)).toMatchObject({ cart: 1, "delete-budget": 1 });
  });

  it("plans nothing when there is nothing to reset", () => {
    const empty = {
      carts: [],
      quotes: [],
      stagedQuotes: [],
      quoteRequests: [],
      shoppingLists: [],
      recurringOrders: [],
      pendingApprovals: [],
      budgets: [],
    };
    expect(planReset(empty)).toEqual([]);
  });
});
