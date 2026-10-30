import { describe, expect, it } from "vitest";
import type { AssociateRole, BusinessUnit, Permission } from "@commercetools/platform-sdk";
import {
  CompanyError,
  editable,
  grantable,
  keepsAManager,
  permissionsIn,
  toCompanyRoles,
  visibleEmail,
} from "@/features/company/permissions";
import type { CompanyRole } from "@/features/company/types";

// Roles shaped like the B2B sample data: admins manage users and the profile, buyers order, approvers approve.
const roles: CompanyRole[] = [
  { key: "admin", name: "Admin", permissions: ["UpdateAssociates", "UpdateBusinessUnitDetails", "ViewOthersOrders"] },
  { key: "buyer", name: "Buyer", permissions: ["CreateMyCarts", "CreateMyOrdersFromMyCarts", "ViewMyOrders"] },
  { key: "approver", name: "Approver", permissions: ["UpdateApprovalFlows", "ViewOthersOrders"] },
  { key: "seller-set", name: "Key account", permissions: [] }, // set by our team: not buyer-assignable
];

const associate = (id: string, ...keys: string[]) => ({
  customer: { typeId: "customer" as const, id },
  associateRoleAssignments: keys.map((key) => ({ associateRole: { typeId: "associate-role" as const, key }, inheritance: "Disabled" })),
});

const unit = (associates: ReturnType<typeof associate>[], inherited: ReturnType<typeof associate>[] = []) =>
  ({ key: "acme", associates, inheritedAssociates: inherited }) as unknown as BusinessUnit;

const forbidden = (fn: () => unknown) => {
  try {
    fn();
  } catch (err) {
    return err instanceof CompanyError ? (err.reason ?? "refused") : "other";
  }
  return "allowed";
};

describe("toCompanyRoles", () => {
  it("gives roles our team sets no permissions a company can hand out", () => {
    const raw = [
      { key: "buyer", name: "Buyer", buyerAssignable: true, permissions: ["CreateMyCarts"] },
      { key: "kam", name: "Key account", buyerAssignable: false, permissions: ["UpdateAssociates"] },
    ] as unknown as AssociateRole[];
    expect(toCompanyRoles(raw).map((r) => r.permissions)).toEqual([["CreateMyCarts"], []]);
  });
});

describe("permissionsIn", () => {
  it("joins direct and inherited roles", () => {
    const bu = unit([associate("ann", "buyer")], [associate("ann", "approver")]);
    expect([...permissionsIn(bu, "ann", roles)!].sort()).toEqual(
      ["CreateMyCarts", "CreateMyOrdersFromMyCarts", "UpdateApprovalFlows", "ViewMyOrders", "ViewOthersOrders"].sort(),
    );
  });

  it("is undefined for someone who is no longer a member", () => {
    expect(permissionsIn(unit([associate("ann", "admin")]), "bob", roles)).toBeUndefined();
  });

  it("ignores role keys that don't exist", () => {
    expect(permissionsIn(unit([associate("ann", "ghost")]), "ann", roles)?.size).toBe(0);
  });
});

describe("visibleEmail", () => {
  const colleague = { id: "bob", email: "bob@example.com" };
  it("shows colleagues' emails only to those who manage users", () => {
    expect(visibleEmail(new Set<Permission>(["UpdateAssociates"]), "ann", colleague)).toBe("bob@example.com");
    expect(visibleEmail(new Set<Permission>(["ViewOthersOrders"]), "ann", colleague)).toBe("");
  });
  it("always shows your own", () => {
    expect(visibleEmail(new Set<Permission>(), "bob", colleague)).toBe("bob@example.com");
  });
});

describe("grantable", () => {
  const admin = new Set<Permission>(["UpdateAssociates", "UpdateBusinessUnitDetails", "ViewOthersOrders"]);

  it("lets an admin give the buyer role: own-purchase permissions don't count", () => {
    expect(grantable(["buyer"], { roles, actor: admin })).toEqual(["buyer"]);
  });

  it("refuses a role with more power than the admin holds", () => {
    expect(forbidden(() => grantable(["approver"], { roles, actor: admin }))).toBe("forbidden");
  });

  it("drops unknown and seller-set roles, and refuses when nothing is left", () => {
    expect(grantable(["buyer", "ghost", "seller-set", "buyer"], { roles, actor: admin })).toEqual(["buyer"]);
    expect(forbidden(() => grantable(["seller-set"], { roles, actor: admin }))).toBe("refused");
  });
});

describe("keepsAManager", () => {
  it("refuses to take the last admin's role away", () => {
    const bu = unit([associate("ann", "admin"), associate("bob", "buyer")]);
    expect(forbidden(() => keepsAManager({ bu, roles }, { customerId: "ann", roles: ["buyer"] }))).toBe("refused");
    expect(forbidden(() => keepsAManager({ bu, roles }, { customerId: "ann" }))).toBe("refused");
  });

  it("allows it while another admin remains, directly or through the parent unit", () => {
    const two = unit([associate("ann", "admin"), associate("bob", "admin")]);
    expect(forbidden(() => keepsAManager({ bu: two, roles }, { customerId: "ann" }))).toBe("allowed");
    const inherited = unit([associate("ann", "admin")], [associate("cy", "admin")]);
    expect(forbidden(() => keepsAManager({ bu: inherited, roles }, { customerId: "ann", roles: ["buyer"] }))).toBe("allowed");
  });
});

describe("editable", () => {
  const bu = unit(
    [associate("ann", "admin"), associate("bob", "buyer"), associate("kim", "buyer", "seller-set")],
    [associate("cy", "buyer")],
  );

  it("returns an explicit member's assignment", () => {
    expect(editable({ bu, roles }, "ann", "bob").customer.id).toBe("bob");
  });

  it("refuses yourself, inherited members and people with a role set by our team", () => {
    expect(forbidden(() => editable({ bu, roles }, "ann", "ann"))).toBe("refused");
    expect(forbidden(() => editable({ bu, roles }, "ann", "cy"))).toBe("refused");
    expect(forbidden(() => editable({ bu, roles }, "ann", "kim"))).toBe("refused");
  });
});
