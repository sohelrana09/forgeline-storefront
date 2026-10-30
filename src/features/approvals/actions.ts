"use server";

// Public endpoints for order approvals. Signed-in business context, rate limit, input checks; the service re-checks
// the approver's permission, the flow's state and version, and refuses their own orders.

import { refresh } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { tooManyAttempts } from "@/lib/rate-limit";
import { requireBusinessContext } from "@/features/business-units/context";
import { ApprovalError, decideApproval } from "@/features/approvals/service";
import { REASON_MAX } from "@/features/approvals/utils";
import type { ApprovalActionState } from "@/features/approvals/types";

export async function decideApprovalAction(_prev: ApprovalActionState, formData: FormData): Promise<ApprovalActionState> {
  const { session, context } = await requireBusinessContext();
  if (await tooManyAttempts(`approval:${session.customerId}`, 60))
    return { error: "Too many decisions. Please wait a few minutes and try again." };
  const flowId = String(formData.get("flowId") ?? "");
  const version = Number(formData.get("version"));
  const decision = formData.get("decision");
  if (decision !== "approve" && decision !== "reject" && decision !== "retry-cancel") return { error: "Choose approve or reject." };
  const reason = String(formData.get("reason") ?? "").trim();
  if (!Number.isInteger(version) || version < 1) return { error: "Please review the order again." };
  if (decision === "reject" && !reason) return { error: "Tell the buyer why you reject the order." };
  if (reason.length > REASON_MAX) return { error: `Keep the reason under ${REASON_MAX} characters.` };
  try {
    const result = await decideApproval(context, session.customerId, flowId, version, decision, reason);
    refresh();
    if (result.cancelFailed) {
      return {
        error: "You rejected the order, but it couldn't be cancelled yet. Use Retry cancellation, or tell our sales team.",
      };
    }
    return {
      done:
        decision === "retry-cancel"
          ? "The rejected order is now cancelled."
          : result.status === "Approved"
            ? "You approved the order. It will now be processed."
            : result.status === "Rejected"
              ? "You rejected the order. It was cancelled and the buyer was told why."
              : "You approved this step. The order now waits for the next approver.",
    };
  } catch (err) {
    unstable_rethrow(err);
    if (err instanceof ApprovalError) return { error: err.message };
    console.error("approval decision failed", (err as { body?: unknown })?.body ?? err);
    return { error: "Your decision could not be saved. Please try again." };
  }
}
