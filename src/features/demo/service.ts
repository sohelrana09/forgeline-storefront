import "server-only";
import type { ApprovalFlow, Order } from "@commercetools/platform-sdk";
import { apiRoot, asAssociate } from "@/lib/commercetools/client";
import { firstCode, statusOf } from "@/lib/commercetools/errors";
import { reportEvent } from "@/lib/error-report";
import { setOrderApproval } from "@/features/approvals/service";
import { cancelUnpaidOrder } from "@/features/order-processing/service";
import { BUDGET_CONTAINER } from "@/features/spending-limits/budget";
import { planReset, summarizePlan, type ResetStep } from "@/features/demo/demo";
import { readReset, type Personas } from "@/features/demo/reset-data";

// The nightly demo reset (/api/cron/demo-reset; `npm run ct:demo-reset -- --yes` calls it). Reads what the personas created, plans with
// `planReset` (pure) and carries it out step by step; one failed step is reported and the rest still run.

async function runStep(step: ResetStep, p: Personas): Promise<void> {
  if (step.kind === "delete-budget") {
    const obj = apiRoot.customObjects().withContainerAndKey({ container: BUDGET_CONTAINER, key: step.key });
    await obj.delete().execute();
    return;
  }
  if (step.kind === "reject-approval") return rejectApproval(step, p);
  const args = { queryArgs: { version: step.version } };
  const id = { ID: step.id };
  switch (step.resource) {
    case "quote":
      await apiRoot.quotes().withId(id).delete(args).execute();
      break;
    case "staged-quote":
      await apiRoot.stagedQuotes().withId(id).delete(args).execute();
      break;
    case "quote-request":
      await apiRoot.quoteRequests().withId(id).delete(args).execute();
      break;
    case "recurring-order":
      await apiRoot.recurringOrders().withId(id).delete(args).execute();
      break;
    case "cart":
      await apiRoot.carts().withId(id).delete(args).execute();
      break;
    case "shopping-list":
      await apiRoot.shoppingLists().withId(id).delete(args).execute();
      break;
  }
}

// Rejected as the approver persona, or the admin when the approver's roles don't cover the pending step; then the
// order is cancelled as on a real rejection.
async function rejectApproval(step: Extract<ResetStep, { kind: "reject-approval" }>, p: Personas) {
  let flow: ApprovalFlow | undefined;
  for (const actor of [p.ids.approver, p.ids.admin]) {
    try {
      flow = (
        await asAssociate(actor, step.unitKey)
          .approvalFlows()
          .withId({ ID: step.id })
          .post({
            body: { version: step.version, actions: [{ action: "reject", reason: "Nightly demo reset" }] },
            queryArgs: { expand: ["order"] },
          })
          .execute()
      ).body;
      break;
    } catch (err) {
      if (firstCode(err) !== "AssociateMissingPermission" && statusOf(err) !== 403) throw err;
    }
  }
  if (!flow) throw new Error("neither the approver nor the admin may reject this approval");
  const order = flow.order.obj as Order | undefined;
  if (flow.status === "Rejected" && order) {
    await setOrderApproval(order.id, "Rejected");
    if (order.orderState !== "Cancelled") await cancelUnpaidOrder(order);
  }
}

export async function resetDemo({ dryRun }: { dryRun: boolean }) {
  const { personas: p, input } = await readReset();
  const steps = planReset(input);
  const planned = summarizePlan(steps);
  if (dryRun) return { units: p.units, planned, done: 0, failed: 0 };
  let done = 0;
  let failed = 0;
  for (const step of steps) {
    try {
      await runStep(step, p);
      done++;
    } catch (err) {
      // Gone already (a visitor deleted it meanwhile) counts as done.
      if (statusOf(err) === 404) {
        done++;
        continue;
      }
      failed++;
      reportEvent("demo_reset_step_failed", err, { kind: step.kind, resource: step.kind === "delete" ? step.resource : undefined });
    }
  }
  return { units: p.units, planned, done, failed };
}
