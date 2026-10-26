import type { Permission } from "@commercetools/platform-sdk";

export type CompanyMember = {
  customerId: string;
  name: string;
  email: string;
  // Roles held directly in this unit, and roles inherited from a parent unit (read-only here).
  roles: string[];
  inheritedRoles: string[];
  explicit: boolean;
};

export type CompanyRole = { key: string; name: string; permissions: Permission[] };

export type CompanyUnit = {
  key: string;
  name: string;
  unitType: string;
  parentKey?: string;
  status: string;
  contactEmail?: string;
};

export type CompanyActionState = { error?: string; saved?: string };

// An approval rule as the company area shows and edits it.
export type ApprovalRuleSummary = {
  id: string;
  version: number;
  name: string;
  description?: string;
  active: boolean;
  // Set when the condition is "order total above amount" (in the unit's currency), the one the form edits.
  amount?: number;
  condition: string;
  requesters: string[];
  approvers: string[];
  steps: number;
};

export type ApprovalRuleInput = {
  id?: string;
  version?: number;
  name: string;
  description: string;
  active: boolean;
  amount: number;
  requesters: string[];
  approvers: string[];
};
