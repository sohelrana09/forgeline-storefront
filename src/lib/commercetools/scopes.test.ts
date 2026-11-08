import { describe, expect, it } from "vitest";
import { FEATURE_SCOPES, RUNTIME_SCOPES, compareScopes, requiredScopes, runtimeScopes } from "@/lib/commercetools/scopes";

describe("compareScopes", () => {
  it("accepts exactly the runtime scopes", () => {
    expect(compareScopes([...RUNTIME_SCOPES])).toEqual({ missing: [], extra: [] });
  });

  it("counts a Manage scope as covering its View scope, and the views it implies as allowed", () => {
    const granted: string[] = [...RUNTIME_SCOPES.filter((s) => s !== "view_stores"), "view_customers", "view_orders"];
    expect(compareScopes(granted).missing).toEqual(["view_stores"]);
    expect(compareScopes(granted).extra).toEqual([]);
  });

  it("reports what a client set up with Manage on the catalog lacks and has too much of", () => {
    // A client like the first runtime client on the demo project: Manage ticked on catalog resources, no business units.
    const granted = [
      "manage_approval_flows",
      "manage_approval_rules",
      "manage_associate_roles",
      "manage_categories",
      "manage_customers",
      "manage_key_value_documents",
      "manage_orders",
      "manage_products",
      "manage_quotes",
      "manage_shipping_methods",
      "manage_shopping_lists",
      "manage_standalone_prices",
      "manage_stores",
      "view_products",
    ];
    expect(compareScopes(granted)).toEqual({
      missing: ["manage_business_units", "manage_sessions", "manage_payments"],
      extra: ["manage_associate_roles", "manage_categories", "manage_shipping_methods", "manage_standalone_prices", "manage_stores"],
    });
  });
});

describe("feature scopes", () => {
  it("adds a feature's scopes only when its flag is on", () => {
    expect(requiredScopes({})).toEqual([...RUNTIME_SCOPES]);
    expect(requiredScopes({ RECURRING_ORDERS: "true" })).toEqual([...RUNTIME_SCOPES, ...FEATURE_SCOPES.RECURRING_ORDERS]);
    expect(requiredScopes({ RECURRING_ORDERS: "1" })).toEqual([...RUNTIME_SCOPES]);
  });
  it("checks a client against the switched-on features", () => {
    const required = requiredScopes({ RECURRING_ORDERS: "true" });
    expect(compareScopes([...RUNTIME_SCOPES], required).missing).toEqual(["manage_recurring_orders", "view_recurrence_policies"]);
    expect(compareScopes([...RUNTIME_SCOPES, "manage_recurring_orders", "view_recurrence_policies"], required)).toEqual({
      missing: [],
      extra: [],
    });
  });
  it("lists them with the project key", () =>
    expect(runtimeScopes("p", { RECURRING_ORDERS: "true" })).toContain("manage_recurring_orders:p"));
});
