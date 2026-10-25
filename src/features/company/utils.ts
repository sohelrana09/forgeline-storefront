import type { Permission } from "@commercetools/platform-sdk";
import type { BuyerContext } from "@/features/business-units/types";

export const can = (context: Pick<BuyerContext, "permissions">, permission: Permission) => context.permissions.includes(permission);

// Plain-language labels for associate-role permissions, grouped like Magento's role editor.
export const PERMISSION_GROUPS: { title: string; permissions: [Permission, string][] }[] = [
  {
    title: "Own purchasing",
    permissions: [
      ["CreateMyCarts", "Create carts"],
      ["UpdateMyCarts", "Edit own carts"],
      ["CreateMyOrdersFromMyCarts", "Place orders"],
      ["ViewMyOrders", "View own orders"],
      ["CreateMyQuoteRequestsFromMyCarts", "Request quotes"],
      ["ViewMyQuotes", "View own quotes"],
      ["AcceptMyQuotes", "Accept own quotes"],
      ["DeclineMyQuotes", "Decline own quotes"],
      ["RenegotiateMyQuotes", "Renegotiate own quotes"],
    ],
  },
  {
    title: "Colleagues' purchasing",
    permissions: [
      ["ViewOthersCarts", "View others' carts"],
      ["UpdateOthersCarts", "Edit others' carts"],
      ["ViewOthersOrders", "View others' orders"],
      ["UpdateOthersOrders", "Edit others' orders"],
      ["ViewOthersQuotes", "View others' quotes"],
      ["AcceptOthersQuotes", "Accept others' quotes"],
      ["DeclineOthersQuotes", "Decline others' quotes"],
    ],
  },
  {
    title: "Company administration",
    permissions: [
      ["UpdateBusinessUnitDetails", "Edit company profile"],
      ["UpdateAssociates", "Manage company users"],
      ["AddChildUnits", "Add divisions"],
      ["UpdateParentUnit", "Change parent unit"],
    ],
  },
  {
    title: "Approvals",
    permissions: [
      ["CreateApprovalRules", "Create approval rules"],
      ["UpdateApprovalRules", "Edit approval rules"],
      ["UpdateApprovalFlows", "Approve or reject orders"],
    ],
  },
];

export const roleLabel = (key: string, roles: { key: string; name: string }[]) => roles.find((r) => r.key === key)?.name ?? key;

export const EMAIL_PATTERN = /^[^\s@"\\]{1,64}@[^\s@"\\]{1,190}\.[A-Za-z]{2,}$/;
export const COMPANY_NAME_PATTERN = /^[\p{L}\p{M}\p{N}' .,&()/-]{2,100}$/u;
