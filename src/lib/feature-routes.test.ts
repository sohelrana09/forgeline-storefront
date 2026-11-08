import { describe, expect, it } from "vitest";
import { isDisabledFeaturePath } from "./feature-routes";

describe("isDisabledFeaturePath", () => {
  it("blocks a switched-off feature's pages, with or without a trailing slash or other casing", () => {
    expect(isDisabledFeaturePath("/punchout", {})).toBe(true);
    expect(isDisabledFeaturePath("/PunchOut/", {})).toBe(true);
    expect(isDisabledFeaturePath("/account/company/budgets", {})).toBe(true);
    expect(isDisabledFeaturePath("/account/shared-carts/abc", {})).toBe(true);
  });

  it("lets them through once the flag is on", () => {
    expect(isDisabledFeaturePath("/punchout", { PUNCHOUT: "true" })).toBe(false);
    expect(isDisabledFeaturePath("/account/recurring-orders", { RECURRING_ORDERS: "1" })).toBe(true);
    expect(isDisabledFeaturePath("/account/recurring-orders", { RECURRING_ORDERS: "true" })).toBe(false);
  });

  it("leaves other pages alone, including look-alike prefixes", () => {
    expect(isDisabledFeaturePath("/account", {})).toBe(false);
    expect(isDisabledFeaturePath("/account/company", {})).toBe(false);
    expect(isDisabledFeaturePath("/punchout-guide", {})).toBe(false);
  });
});
