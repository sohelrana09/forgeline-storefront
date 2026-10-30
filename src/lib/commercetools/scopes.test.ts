import { describe, expect, it } from "vitest";
import { RUNTIME_SCOPES, compareScopes } from "@/lib/commercetools/scopes";

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
      missing: ["manage_business_units", "manage_sessions"],
      extra: [
        "manage_associate_roles",
        "manage_categories",
        "manage_products",
        "manage_shipping_methods",
        "manage_standalone_prices",
        "manage_stores",
      ],
    });
  });
});
