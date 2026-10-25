import type { Order } from "@commercetools/platform-sdk";

export type ApprovalStatus = "Pending" | "Approved" | "Rejected";

// One order's approval (a commercetools Approval Flow), as the storefront shows it.
export type OrderApproval = {
  flowId: string;
  version: number;
  orderId: string;
  status: ApprovalStatus;
  createdAt: string;
  // The rules that matched, by name ("Orders over €10,000").
  rules: string[];
  // Roles that can approve the current step (any one of them), e.g. ["approver", "admin"].
  pendingRoles: string[];
  approvals: { by: string; at: string }[];
  rejection?: { by: string; at: string; reason: string };
};

export type ApprovalItem = { approval: OrderApproval; order: Order };

export type ApprovalActionState = { error?: string; done?: string };
