import "server-only";
import type { ApprovalFlow, ApprovalFlowUpdateAction, Order } from "@commercetools/platform-sdk";
import { apiRoot, asAssociate } from "@/lib/commercetools/client";
import { sendMail, siteUrl } from "@/lib/mailer";
import { formatMoney } from "@/lib/utils";
import { businessUnitNow, hasPermissionNow } from "@/features/business-units/service";
import type { PricingContext } from "@/features/business-units/types";
import { orderReference } from "@/features/orders/service";
import { UUID } from "@/features/orders/utils";
import type { ApprovalItem, OrderApproval } from "@/features/approvals/types";

// Order approvals (Magento B2B "Order approvals"), on commercetools Approval Flows. A flow is created by
// commercetools when an order matches an Active approval rule of the unit; the order itself exists (Open) from the
// start, so "pending" lives only on the flow. Flows are reachable only "as associate": the admin client calls
// as-associate/{id}/in-business-unit/key={unit}/approval-flows with the signed-in customer's id, after a live
// permission check. commercetools then also enforces that associate's roles and the rule's approver tiers.

export class ApprovalError extends Error {}

const statusOf = (err: unknown) => (err as { body?: { statusCode?: number } })?.body?.statusCode;
const errorCode = (err: unknown) => (err as { body?: { errors?: { code?: string }[] } })?.body?.errors?.[0]?.code;
const flows = (ctx: PricingContext, associateId: string) => asAssociate(associateId, ctx.businessUnitKey).approvalFlows();

export function toApproval(flow: ApprovalFlow): OrderApproval {
  return {
    flowId: flow.id,
    version: flow.version,
    orderId: flow.order.id,
    status: flow.status as OrderApproval["status"],
    createdAt: flow.createdAt,
    rules: flow.rules.map((r) => r.name),
    pendingRoles: flow.currentTierPendingApprovers.map((a) => a.associateRole.key),
    approvals: flow.approvals.map((a) => ({ by: a.approver.customer.id, at: a.approvedAt })),
    ...(flow.rejection && {
      rejection: { by: flow.rejection.rejecter.customer.id, at: flow.rejection.rejectedAt, reason: flow.rejection.reason ?? "" },
    }),
  };
}

// The approvals of orders the viewer may already see: order id → approval. Callers must pass only ids they have
// just read with the viewer's own token, or after a live ViewOthersOrders check (the flows show rejection reasons
// and approvers). Any member may read the unit's flows. Display only, so a failure shows orders without a status
// instead of breaking the page.
export async function approvalsForOrders(ctx: PricingContext, viewerId: string, orderIds: string[]): Promise<Record<string, OrderApproval>> {
  const ids = orderIds.filter((id) => UUID.test(id));
  if (!ctx.businessUnitKey || ids.length === 0) return {};
  try {
    const { body } = await flows(ctx, viewerId)
      .get({ queryArgs: { where: `order(id in (${ids.map((id) => `"${id}"`).join(", ")}))`, limit: 500 } })
      .execute();
    return Object.fromEntries(body.results.map((f) => [f.order.id, toApproval(f)]));
  } catch (err) {
    console.error("approval status lookup failed", (err as { body?: unknown })?.body ?? err);
    return {};
  }
}

// A read started before a permission check: if the check refuses first, the read's own failure must not surface
// as an unhandled rejection.
function started<T>(promise: Promise<T>): Promise<T> {
  promise.catch(() => undefined);
  return promise;
}

async function requireApprover(ctx: PricingContext, approverId: string) {
  if (!ctx.businessUnitKey || !(await hasPermissionNow(ctx.businessUnitKey, approverId, "UpdateApprovalFlows"))) {
    throw new ApprovalError("You can't approve orders for this company.");
  }
}

// The approver's list (Magento "Order approvals"): pending first by default, newest first, with the orders.
export async function pageApprovals(ctx: PricingContext, approverId: string, view: "pending" | "all", page: number, size: number) {
  // The flows are read alongside the live permission check, whose refusal comes first; nothing is returned unless
  // it passes.
  const read = started(
    flows(ctx, approverId).get({
      queryArgs: {
        ...(view === "pending" && { where: 'status="Pending"' }),
        expand: ["order"],
        sort: ["createdAt desc"],
        limit: size,
        offset: (page - 1) * size,
        withTotal: true,
      },
    }).execute(),
  );
  await requireApprover(ctx, approverId);
  const { body } = await read;
  // Flows always reference an existing order; one without it (deleted order) counts as gone from the total too.
  const items: ApprovalItem[] = body.results.filter((f) => f.order.obj).map((f) => ({ approval: toApproval(f), order: f.order.obj as Order }));
  return { items, total: (body.total ?? body.count) - (body.results.length - items.length) };
}

// The approver's roles in the unit right now (explicit and inherited).
async function rolesOf(ctx: PricingContext, customerId: string): Promise<string[]> {
  const bu = await businessUnitNow(ctx.businessUnitKey);
  return [...bu.associates, ...(bu.inheritedAssociates ?? [])]
    .filter((a) => a.customer.id === customerId)
    .flatMap((a) => a.associateRoleAssignments.map((r) => r.associateRole.key));
}

// One approval for its detail page, and whether this approver may decide it now: still pending, not their own
// order, and one of their roles is among the current step's approvers (commercetools checks this again).
export async function getApproval(ctx: PricingContext, approverId: string, flowId: string) {
  if (!UUID.test(flowId)) return undefined;
  // Permission check, flow and the approver's roles together (the unit is read once for both); nothing is
  // returned unless the check passes.
  const read = started(
    Promise.all([
      flows(ctx, approverId)
        .withId({ ID: flowId })
        .get({ queryArgs: { expand: ["order"] } })
        .execute()
        .then((r) => r.body)
        .catch((err) => (statusOf(err) === 404 ? undefined : Promise.reject(err))),
      rolesOf(ctx, approverId),
    ]),
  );
  await requireApprover(ctx, approverId);
  const [flow, roles] = await read;
  if (!flow?.order.obj) return undefined;
  const approval = toApproval(flow);
  const order = flow.order.obj as Order;
  // A rejection whose cancellation failed can be retried from the page.
  const cancelPending = approval.status === "Rejected" && order.orderState !== "Cancelled";
  const canDecide =
    approval.status === "Pending" &&
    order.orderState !== "Cancelled" &&
    order.customerId !== approverId &&
    approval.pendingRoles.some((r) => roles.includes(r));
  return { approval, order, canDecide, cancelPending, ownOrder: order.customerId === approverId };
}

// Approve or reject. Checked live: the permission, that the flow is still pending at the version the approver
// looked at, and that it isn't their own order. A rejected order is cancelled (commercetools leaves it Open); if
// that fails, the rejection still stands and "retry-cancel" repeats only the cancellation.
export async function decideApproval(
  ctx: PricingContext,
  approverId: string,
  flowId: string,
  version: number,
  decision: "approve" | "reject" | "retry-cancel",
  reason: string,
): Promise<OrderApproval & { cancelFailed?: boolean }> {
  if (!UUID.test(flowId)) throw new ApprovalError("Unknown approval.");
  await requireApprover(ctx, approverId);
  const flow = await flows(ctx, approverId)
    .withId({ ID: flowId })
    .get({ queryArgs: { expand: ["order"] } })
    .execute()
    .then((r) => r.body)
    .catch((err) => (statusOf(err) === 404 ? undefined : Promise.reject(err)));
  const order = flow?.order.obj as Order | undefined;
  if (!flow || !order) throw new ApprovalError("Unknown approval.");
  if (decision === "retry-cancel") {
    if (flow.status !== "Rejected") throw new ApprovalError("Only a rejected order is cancelled.");
    await cancelOrder(order);
    return toApproval(flow);
  }
  if (flow.status !== "Pending") throw new ApprovalError(`This order was already ${flow.status.toLowerCase()}.`);
  if (flow.version !== version) throw new ApprovalError("This approval changed since you opened it. Please review it again.");
  if (order.customerId === approverId) throw new ApprovalError("You can't approve or reject your own order.");
  // Cancelled meanwhile (by the seller or the buyer): approving it would mean nothing.
  if (order.orderState === "Cancelled") throw new ApprovalError("This order was cancelled, so it no longer needs approval.");

  const action: ApprovalFlowUpdateAction = decision === "approve" ? { action: "approve" } : { action: "reject", reason };
  let updated: ApprovalFlow;
  try {
    updated = (await flows(ctx, approverId).withId({ ID: flowId }).post({ body: { version, actions: [action] } }).execute()).body;
  } catch (err) {
    if (statusOf(err) === 409) throw new ApprovalError("Someone else handled this order at the same time. Please review it again.");
    if (errorCode(err) === "AssociateMissingPermission" || statusOf(err) === 403) {
      throw new ApprovalError("Your role can't decide this step of the approval.");
    }
    throw err;
  }
  let cancelFailed = false;
  if (updated.status === "Rejected") {
    try {
      await cancelOrder(order);
    } catch (err) {
      cancelFailed = true;
      console.error("cancelling a rejected order failed", order.id, (err as { body?: unknown })?.body ?? err);
    }
  }
  await notifyBuyer(order, updated);
  return { ...toApproval(updated), cancelFailed };
}

// The rejected order must not be processed: cancel it in its store (retry once if it changed meanwhile).
async function cancelOrder(order: Order) {
  const storeKey = order.store?.key;
  if (!storeKey) throw new Error(`order ${order.id} has no store`);
  const orders = apiRoot.inStoreKeyWithStoreKeyValue({ storeKey }).orders().withId({ ID: order.id });
  for (let attempt = 1; ; attempt++) {
    const { body: current } = attempt === 1 ? { body: order } : await orders.get().execute();
    if (current.orderState === "Cancelled") return;
    try {
      await orders.post({ body: { version: current.version, actions: [{ action: "changeOrderState", orderState: "Cancelled" }] } }).execute();
      return;
    } catch (err) {
      if (statusOf(err) !== 409 || attempt === 2) throw err;
    }
  }
}

// ---------- Emails (development: printed to the server log; see src/lib/mailer.ts) ----------

const customerEmail = async (id: string) =>
  apiRoot
    .customers()
    .withId({ ID: id })
    .get()
    .execute()
    .then((r) => r.body.email)
    .catch(() => undefined);

// A new order waiting for approval: tell the unit's members who can approve the current step.
export async function notifyApprovers(ctx: PricingContext, order: Order, approval: OrderApproval) {
  try {
    const { body: bu } = await apiRoot.businessUnits().withKey({ key: ctx.businessUnitKey }).get().execute();
    const ids = [...bu.associates, ...(bu.inheritedAssociates ?? [])]
      .filter((a) => a.customer.id !== order.customerId && a.associateRoleAssignments.some((r) => approval.pendingRoles.includes(r.associateRole.key)))
      .map((a) => a.customer.id);
    const unique = [...new Set(ids)];
    const emails = unique.length
      ? (await apiRoot.customers().get({ queryArgs: { where: `id in (${unique.map((id) => `"${id}"`).join(", ")})`, limit: unique.length } }).execute()).body.results.map((c) => c.email)
      : [];
    const ref = orderReference(order);
    await Promise.all(
      emails.map((to) =>
        sendMail({
          to,
          subject: `Order ${ref} is waiting for your approval`,
          text: `Order ${ref} (${formatMoney(order.taxedPrice?.totalGross ?? order.totalPrice)}) for ${ctx.businessUnitName} needs approval: ${approval.rules.join(", ")}.\n\nReview it: ${siteUrl()}/account/approvals/${approval.flowId}`,
        }),
      ),
    );
  } catch (err) {
    console.error("approval notification failed", (err as { body?: unknown })?.body ?? err);
  }
}

async function notifyBuyer(order: Order, flow: ApprovalFlow) {
  if (flow.status === "Pending" || !order.customerId) return;
  try {
    const to = order.customerEmail ?? (await customerEmail(order.customerId));
    if (!to) return;
    const ref = orderReference(order);
    const text =
      flow.status === "Approved"
        ? `Your order ${ref} was approved and will now be processed.`
        : `Your order ${ref} was rejected and cancelled.\n\nReason: ${flow.rejection?.reason ?? "none given"}`;
    await sendMail({ to, subject: `Order ${ref} ${flow.status.toLowerCase()}`, text: `${text}\n\n${siteUrl()}/account/orders/${order.id}` });
  } catch (err) {
    console.error("approval notification failed", (err as { body?: unknown })?.body ?? err);
  }
}
