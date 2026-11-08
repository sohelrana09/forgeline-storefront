import { describe, expect, it } from "vitest";
import {
  amountInput,
  decide,
  decisionMessage,
  parseBudgetDoc,
  parseRule,
  periodBounds,
  spendingLimitsEnabled,
  spent,
  status,
  type BudgetRule,
} from "@/features/spending-limits/budget";

const BUYER = "7c9e6679-7425-40de-944b-e07fc1f90ae7";
const eur = (centAmount: number) => ({ centAmount, currencyCode: "EUR" });
const order = (createdAt: string, net: number, over: Record<string, unknown> = {}) => ({
  orderState: "Open",
  createdAt,
  customerId: BUYER,
  totalPrice: eur(net * 1.21),
  taxedPrice: { totalNet: eur(net) },
  ...over,
});

describe("periodBounds", () => {
  it("is the calendar month or quarter in UTC", () => {
    const now = new Date("2026-11-08T23:59:00Z");
    expect(periodBounds("monthly", now)).toEqual({ start: new Date("2026-11-01T00:00:00Z"), end: new Date("2026-12-01T00:00:00Z") });
    expect(periodBounds("quarterly", now)).toEqual({ start: new Date("2026-10-01T00:00:00Z"), end: new Date("2027-01-01T00:00:00Z") });
    expect(periodBounds("quarterly", new Date("2026-03-31T12:00:00Z")).start).toEqual(new Date("2026-01-01T00:00:00Z"));
  });
});

describe("spent", () => {
  const bounds = periodBounds("monthly", new Date("2026-11-15T00:00:00Z"));
  const orders = [
    order("2026-11-01T00:00:00Z", 1000),
    order("2026-11-20T10:00:00Z", 500, { customerId: "someone-else" }),
    order("2026-11-21T10:00:00Z", 700, { orderState: "Cancelled" }),
    order("2026-10-31T23:59:59Z", 9999),
    order("2026-12-01T00:00:00Z", 9999),
    order("2026-11-02T00:00:00Z", 300, { taxedPrice: { totalNet: { centAmount: 300, currencyCode: "USD" } } }),
  ];
  it("adds net totals of non-cancelled orders inside the period, in the currency", () => {
    expect(spent(orders, "EUR", bounds)).toBe(1500);
  });
  it("counts one buyer's orders only when asked", () => expect(spent(orders, "EUR", bounds, BUYER)).toBe(1000));
  it("falls back to the total when an order has no tax yet", () => {
    expect(spent([{ ...order("2026-11-03T00:00:00Z", 0), taxedPrice: undefined, totalPrice: eur(250) }], "EUR", bounds)).toBe(250);
  });
});

describe("decide", () => {
  const end = new Date("2026-12-01T00:00:00Z");
  const rule = (centAmount: number, mode: BudgetRule["mode"]): BudgetRule => ({ period: "monthly", centAmount, mode });

  it("is ok inside every budget, including exactly at the limit", () => {
    expect(decide([status("unit", rule(10000, "block"), 4000, end)], 6000)).toEqual({ decision: "ok", over: [] });
  });
  it("warns in warn mode and blocks in block mode, block winning", () => {
    const unit = status("unit", rule(10000, "warn"), 9000, end);
    const buyer = status("buyer", rule(2000, "block"), 0, end);
    expect(decide([unit], 3000)).toEqual({ decision: "warn", over: [{ scope: "unit", by: 2000 }] });
    expect(decide([unit, buyer], 3000)).toEqual({
      decision: "block",
      over: [
        { scope: "unit", by: 2000 },
        { scope: "buyer", by: 1000 },
      ],
    });
  });
  it("counts the whole order once a budget is already used up", () => {
    expect(decide([status("unit", rule(1000, "block"), 1500, end)], 200).over).toEqual([{ scope: "unit", by: 200 }]);
  });
  it("words the answer", () => {
    const d = decide([status("buyer", rule(1000, "block"), 0, end)], 1500);
    expect(
      decisionMessage(
        d,
        (c) => `€${c / 100}`,
        () => "monthly",
      ),
    ).toBe("This order exceeds your monthly budget by €5. Reduce the order or ask a company admin to raise the budget.");
    expect(decisionMessage({ decision: "ok", over: [] }, String, () => "monthly")).toBe("");
  });
});

describe("parseRule", () => {
  it("reads amounts in the currency's digits", () => {
    expect(parseRule({ amount: "5,000.50", period: "monthly", mode: "block" }, 2)).toEqual({
      ok: true,
      rule: { period: "monthly", centAmount: 500050, mode: "block" },
    });
    expect(parseRule({ amount: "5000", period: "quarterly", mode: "warn" }, 0)).toEqual({
      ok: true,
      rule: { period: "quarterly", centAmount: 5000, mode: "warn" },
    });
  });
  it("treats an empty amount as no budget", () => expect(parseRule({ amount: " " }, 2)).toEqual({ ok: true }));
  it("refuses bad amounts, periods and modes", () => {
    for (const input of [
      { amount: "-5", period: "monthly", mode: "block" },
      { amount: "0", period: "monthly", mode: "block" },
      { amount: "1.234", period: "monthly", mode: "block" },
      { amount: "1e9", period: "monthly", mode: "block" },
      { amount: "100", period: "weekly", mode: "block" },
      { amount: "100", period: "monthly", mode: "ignore" },
    ]) {
      expect(parseRule(input, 2).ok, JSON.stringify(input)).toBe(false);
    }
  });
  it("round-trips through the form value", () => expect(amountInput(500050, 2)).toBe("5000.50"));
});

describe("parseBudgetDoc", () => {
  it("keeps valid rules and drops the rest", () => {
    const doc = parseBudgetDoc(
      {
        currency: "EUR",
        unit: { period: "monthly", centAmount: 100, mode: "warn" },
        buyers: {
          [BUYER]: { period: "daily", centAmount: 5, mode: "block" },
          "not-an-id": { period: "monthly", centAmount: 5, mode: "block" },
        },
      },
      "EUR",
      2,
    );
    expect(doc.unit).toEqual({ period: "monthly", centAmount: 100, mode: "warn" });
    expect(doc.buyers).toEqual({});
  });
  it("ignores budgets set in another currency", () => {
    expect(parseBudgetDoc({ currency: "USD", unit: { period: "monthly", centAmount: 100, mode: "warn" } }, "EUR", 2).unit).toBeUndefined();
  });
  it("is off unless SPENDING_LIMITS=true", () => {
    expect(spendingLimitsEnabled({})).toBe(false);
    expect(spendingLimitsEnabled({ SPENDING_LIMITS: "true" })).toBe(true);
  });
});
