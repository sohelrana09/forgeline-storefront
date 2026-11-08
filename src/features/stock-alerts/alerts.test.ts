import { describe, expect, it } from "vitest";
import { alertKey, alertOutcome, parseAlert, stockAlertsEnabled } from "@/features/stock-alerts/alerts";

const alert = {
  sku: "air-filter",
  customerId: "c1",
  storeKey: "default-store",
  productSlug: "air-filter",
  createdAt: "2026-11-01T00:00:00Z",
};

describe("stock alerts", () => {
  it("keys one alert per customer and SKU, without the email", () => {
    expect(alertKey("c1", "a")).toMatch(/^[0-9a-f]{64}$/);
    expect(alertKey("c1", "a")).not.toBe(alertKey("c1", "b"));
  });
  it("sends when stock is back, waits, and expires old or unsold ones", () => {
    const now = new Date("2026-11-08T00:00:00Z");
    expect(alertOutcome(alert, 3, now)).toBe("send");
    expect(alertOutcome(alert, 0, now)).toBe("wait");
    expect(alertOutcome(alert, undefined, now)).toBe("wait");
    expect(alertOutcome(alert, null, now)).toBe("expire");
    expect(alertOutcome(alert, 0, new Date("2027-03-01T00:00:00Z"))).toBe("expire");
  });
  it("validates stored alerts and is off by default", () => {
    expect(parseAlert(alert)).toEqual(alert);
    expect(parseAlert({ sku: "x" })).toBeUndefined();
    expect(stockAlertsEnabled({})).toBe(false);
  });
});
