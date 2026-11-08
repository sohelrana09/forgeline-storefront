import "server-only";
import type { Cart, Permission } from "@commercetools/platform-sdk";
import { apiRoot, asAssociate } from "@/lib/commercetools/client";
import { statusOf } from "@/lib/commercetools/errors";
import { str } from "@/lib/predicate";
import { sendMail, siteUrl } from "@/lib/mailer";
import { reportEvent } from "@/lib/error-report";
import { formatMoney } from "@/lib/utils";
import type { Session } from "@/features/auth/session";
import { associateRolesNow, businessUnitNow, permissionsNow } from "@/features/business-units/service";
import type { PricingContext } from "@/features/business-units/types";
import { getActiveCart } from "@/features/cart/service";
import { localize } from "@/features/catalog/utils";
import { permissionsIn } from "@/features/company/permissions";
import { REVIEWER_PERMISSIONS, canReview, endShareActions, readShare, shareActions } from "@/features/shared-carts/share";

// Shared carts (docs/features/shared-carts.md).
// - The sender's own cart is read with their customer token; the share fields are then set with the admin client in
//   the cart's store, like the PO number at checkout.
// - The reviewer reads and takes over carts through the as-associate endpoints
//   (/as-associate/{reviewer}/in-business-unit/key={unit}/carts), where commercetools checks ViewOthersCarts and
//   UpdateOthersCarts itself, and only after the same permissions are checked live here. Ids always come from the
//   session; a cart counts only if it is shared with exactly this reviewer.

export class SharedCartError extends Error {}

const inStore = (ctx: PricingContext) => apiRoot.inStoreKeyWithStoreKeyValue({ storeKey: ctx.storeKey }).carts();

// Colleagues in the selected unit who may review: the permissions in REVIEWER_PERMISSIONS, read live. Names only.
export async function reviewers(ctx: PricingContext, selfId: string): Promise<{ id: string; name: string }[]> {
  const [bu, roleList] = await Promise.all([businessUnitNow(ctx.businessUnitKey), associateRolesNow()]);
  // Every role counts, seller-set ones too, as in permissionsNow (the company area hides those, a check must not).
  const roles = roleList.map((r) => ({ key: r.key, name: r.name ?? r.key, permissions: r.permissions }));
  const ids = [...new Set([...bu.associates, ...(bu.inheritedAssociates ?? [])].map((a) => a.customer.id))].filter(
    (id) => id !== selfId && canReview(permissionsIn(bu, id, roles)),
  );
  if (ids.length === 0) return [];
  const { body } = await apiRoot
    .customers()
    .get({ queryArgs: { where: `id in (${ids.map(str).join(", ")})`, limit: ids.length } })
    .execute();
  return body.results
    .map((c) => ({ id: c.id, name: [c.firstName, c.lastName].filter(Boolean).join(" ") || "Company user" }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

const customerById = (id: string) =>
  apiRoot
    .customers()
    .withId({ ID: id })
    .get()
    .execute()
    .then((r) => r.body)
    .catch(() => undefined);

const linesText = (cart: Cart) =>
  cart.lineItems.map((l) => `${l.quantity} x ${localize(l.name)} (${l.variant.sku ?? ""})`).join("\n") +
  `\n\nTotal: ${formatMoney(cart.totalPrice)}`;

function notify(to: string | undefined, subject: string, text: string, event: string) {
  if (!to) return;
  sendMail({ to, subject, text }).catch((err) => reportEvent(event, err));
}

// The sender sends their own open cart to a reviewer of the same unit.
export async function shareCart(session: Session, ctx: PricingContext, cartId: string | undefined, reviewerId: string, note?: string) {
  const cart = await getActiveCart(session, cartId, ctx);
  if (!cart || cart.lineItems.length === 0) throw new SharedCartError("Your cart is empty.");
  if (!(await reviewers(ctx, session.customerId)).some((r) => r.id === reviewerId)) {
    throw new SharedCartError("That colleague can't review carts. Please choose someone else.");
  }
  const actions = shareActions(cart.custom, {
    sharedWith: reviewerId,
    sharedBy: session.customerId,
    sharedAt: new Date().toISOString(),
    shareNote: note,
  });
  await inStore(ctx)
    .withId({ ID: cart.id })
    .post({ body: { version: cart.version, actions } })
    .execute();
  const [reviewer, sender] = await Promise.all([customerById(reviewerId), customerById(session.customerId)]);
  const who = [sender?.firstName, sender?.lastName].filter(Boolean).join(" ") || "A colleague";
  notify(
    reviewer?.email,
    `${who} sent you a cart to review`,
    `${who} (${ctx.businessUnitName}) sent you a cart to review and order:\n\n${linesText(cart)}${note ? `\n\nTheir note: ${note}` : ""}\n\nReview it: ${siteUrl()}/account/shared-carts`,
    "shared_cart_mail_failed",
  );
}

// The sender takes the share back (their own cart only).
export async function withdrawShare(session: Session, ctx: PricingContext, cartId: string | undefined) {
  const cart = await getActiveCart(session, cartId, ctx);
  if (!cart || readShare(cart.custom).sharedBy !== session.customerId) return;
  const actions = endShareActions(cart.custom, false);
  if (actions.length > 0)
    await inStore(ctx)
      .withId({ ID: cart.id })
      .post({ body: { version: cart.version, actions } })
      .execute();
}

async function requireReviewer(ctx: PricingContext, customerId: string, need: Permission[] = REVIEWER_PERMISSIONS) {
  const held = await permissionsNow(ctx.businessUnitKey, customerId);
  if (!need.every((p) => held.has(p))) throw new SharedCartError("Your role doesn't allow reviewing colleagues' carts.");
}

const asReviewer = (session: Session, ctx: PricingContext) => asAssociate(session.customerId, ctx.businessUnitKey).carts();

export type SharedCartSummary = {
  id: string;
  version: number;
  from: string;
  sharedAt?: string;
  note?: string;
  lines: { sku: string; name: string; quantity: number; total: string }[];
  total: string;
};

// Carts shared with the signed-in reviewer in the selected unit.
export async function cartsSharedWithMe(session: Session, ctx: PricingContext): Promise<SharedCartSummary[]> {
  await requireReviewer(ctx, session.customerId, ["ViewOthersCarts"]);
  const { body } = await asReviewer(session, ctx)
    .get({
      queryArgs: {
        where: `cartState = "Active" and custom(fields(sharedWith = ${str(session.customerId)}))`,
        sort: ["lastModifiedAt desc"],
        limit: 50,
      },
    })
    .execute();
  const senders = [...new Set(body.results.flatMap((c) => (c.customerId ? [c.customerId] : [])))];
  const names = new Map<string, string>();
  if (senders.length > 0) {
    const { body: customers } = await apiRoot
      .customers()
      .get({ queryArgs: { where: `id in (${senders.map(str).join(", ")})`, limit: senders.length } })
      .execute();
    for (const c of customers.results) names.set(c.id, [c.firstName, c.lastName].filter(Boolean).join(" ") || "A colleague");
  }
  return body.results
    .filter((c) => readShare(c.custom).sharedWith === session.customerId && (c.businessUnit?.key ?? "") === ctx.businessUnitKey)
    .map((c) => {
      const share = readShare(c.custom);
      return {
        id: c.id,
        version: c.version,
        from: names.get(c.customerId ?? "") ?? "A colleague",
        sharedAt: share.sharedAt,
        note: share.shareNote,
        lines: c.lineItems.map((l) => ({
          sku: l.variant.sku ?? "",
          name: localize(l.name),
          quantity: l.quantity,
          total: formatMoney(l.totalPrice),
        })),
        total: formatMoney(c.totalPrice),
      };
    });
}

async function readShared(session: Session, ctx: PricingContext, cartId: string): Promise<Cart> {
  const cart = await asReviewer(session, ctx)
    .withId({ ID: cartId })
    .get()
    .execute()
    .then((r) => r.body)
    .catch((err) => (statusOf(err) === 404 ? undefined : Promise.reject(err)));
  if (!cart || cart.cartState !== "Active" || readShare(cart.custom).sharedWith !== session.customerId) {
    throw new SharedCartError("That cart is no longer shared with you.");
  }
  return cart;
}

// The reviewer takes the cart over: it becomes theirs (customer and email), so they edit and check out through the
// normal cart and checkout. Their budget, approval rules and procurement fields then apply. Returns the cart id for
// their cart cookie.
export async function takeOverSharedCart(session: Session, ctx: PricingContext, cartId: string): Promise<string> {
  await requireReviewer(ctx, session.customerId);
  const [cart, me] = await Promise.all([readShared(session, ctx, cartId), customerById(session.customerId)]);
  const senderId = cart.customerId;
  await asReviewer(session, ctx)
    .withId({ ID: cart.id })
    .post({
      body: {
        version: cart.version,
        actions: [
          { action: "setCustomerId", customerId: session.customerId },
          ...(me?.email ? [{ action: "setCustomerEmail" as const, email: me.email }] : []),
          ...endShareActions(cart.custom, true),
        ],
      },
    })
    .execute();
  if (senderId) {
    const sender = await customerById(senderId);
    const who = [me?.firstName, me?.lastName].filter(Boolean).join(" ") || "Your colleague";
    notify(
      sender?.email,
      `${who} took over your cart`,
      `${who} took over the cart you sent for review and will place the order:\n\n${linesText(cart)}`,
      "shared_cart_mail_failed",
    );
  }
  return cart.id;
}

// The reviewer hands it back: the share ends and the sender is told; the cart stays the sender's.
export async function declineSharedCart(session: Session, ctx: PricingContext, cartId: string, reason?: string) {
  await requireReviewer(ctx, session.customerId, ["ViewOthersCarts", "UpdateOthersCarts"]);
  const cart = await readShared(session, ctx, cartId);
  await asReviewer(session, ctx)
    .withId({ ID: cart.id })
    .post({ body: { version: cart.version, actions: endShareActions(cart.custom, false) } })
    .execute();
  if (cart.customerId) {
    const [sender, me] = await Promise.all([customerById(cart.customerId), customerById(session.customerId)]);
    const who = [me?.firstName, me?.lastName].filter(Boolean).join(" ") || "Your colleague";
    notify(
      sender?.email,
      `${who} sent your cart back`,
      `${who} sent back the cart you shared for review.${reason ? `\n\nTheir note: ${reason}` : ""}\n\nYour cart: ${siteUrl()}/cart`,
      "shared_cart_mail_failed",
    );
  }
}
