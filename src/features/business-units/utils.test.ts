import { describe, expect, it } from "vitest";
import { contextsFor, pickContext } from "@/features/business-units/utils";
import type { BuyingContext } from "@/features/business-units/types";

const unit = (key: string, members: { customerId: string; roles: string[]; permissions: string[] }[]) =>
  ({ businessUnitKey: key, members }) as unknown as BuyingContext;

describe("contextsFor", () => {
  it("keeps only the customer's own units and drops the member list", () => {
    const all = [
      unit("a", [{ customerId: "c1", roles: [], permissions: [] }]),
      unit("b", [{ customerId: "c2", roles: [], permissions: [] }]),
    ];
    const contexts = contextsFor(all, "c1");
    expect(contexts.map((c) => c.businessUnitKey)).toEqual(["a"]);
    expect(contexts[0]).not.toHaveProperty("members");
  });

  it("decides canOrder by the permission, whatever the role is called", () => {
    const all = [unit("a", [{ customerId: "c1", roles: ["purchaser"], permissions: ["CreateMyOrdersFromMyCarts"] }])];
    expect(contextsFor(all, "c1")[0].canOrder).toBe(true);
  });

  it("does not let a role called buyer order without the permission", () => {
    const all = [unit("a", [{ customerId: "c1", roles: ["buyer"], permissions: ["ViewMyCarts"] }])];
    expect(contextsFor(all, "c1")[0].canOrder).toBe(false);
  });

  it("merges explicit and inherited listings of one customer", () => {
    const all = [
      unit("a", [
        { customerId: "c1", roles: ["x"], permissions: ["ViewMyCarts"] },
        { customerId: "c1", roles: ["y"], permissions: ["CreateMyOrdersFromMyCarts", "ViewMyCarts"] },
      ]),
    ];
    const [context] = contextsFor(all, "c1");
    expect(context.canOrder).toBe(true);
    expect(context.permissions).toEqual(["ViewMyCarts", "CreateMyOrdersFromMyCarts"]);
  });
});

describe("pickContext", () => {
  const contexts = contextsFor(
    [unit("a", [{ customerId: "c1", roles: [], permissions: [] }]), unit("b", [{ customerId: "c1", roles: [], permissions: [] }])],
    "c1",
  );
  it("takes the selected unit", () => expect(pickContext(contexts, "b").businessUnitKey).toBe("b"));
  it("falls back to the first for a key that isn't theirs", () => expect(pickContext(contexts, "z").businessUnitKey).toBe("a"));
});
