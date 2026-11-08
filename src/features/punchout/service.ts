import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import type { Cart, CartUpdateAction } from "@commercetools/platform-sdk";
import { apiRoot } from "@/lib/commercetools/client";
import { statusOf } from "@/lib/commercetools/errors";
import { str } from "@/lib/predicate";
import { siteUrl } from "@/lib/site-url";
import { localize } from "@/features/catalog/utils";
import { cookieOptions, sealCookie, unsealCookie } from "@/features/auth/session";
import { getCustomerContexts, type PricingContext } from "@/features/business-units/service";
import type { BuyerContext } from "@/features/business-units/types";
import { cartAddress, lookupSkus } from "@/features/cart/service";
import { parseQuickOrder } from "@/features/quick-order/parser";
import { CxmlError, decimal, orderMessage } from "@/features/punchout/cxml";
import { ociFields } from "@/features/punchout/oci";
import {
  CONFIG_CONTAINER,
  SESSION_CONTAINER,
  SESSION_TTL_MS,
  START_TTL_MS,
  parseConfig,
  type Format,
  type PunchoutConfig,
  type PunchoutSession,
} from "@/features/punchout/config";

// PunchOut (docs/features/punchout.md).
// 1. The buyer's procurement system posts a setup request (cXML PunchOutSetupRequest, or the OCI call) with its
//    identity and shared secret. A matching config (Custom Object punchout-config/<unit>) names the associate and the
//    allowed return hosts. We create a fresh cart for that associate in the unit's store (admin client, in-store) and
//    a one-time start token (Custom Object punchout-session/<sha256 of the token>, 5 minutes).
// 2. The buyer's browser opens /api/punchout/start?token=..., which redeems the token once and sets the sealed
//    ct_punchout cookie (8 hours). /punchout shows that cart only: add by SKU, change quantities.
// 3. "Return cart" posts the cart back to the procurement system (cXML PunchOutOrderMessage or OCI fields) from a
//    page with its own CSP whose form-action is the configured return host only.
// The cookie holds no token: every cart read and write goes through the admin client on the one cart id it names,
// after checking that the cart still belongs to that associate, unit and store.

export const PUNCHOUT_COOKIE = "ct_punchout";
const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export async function findConfig(domain: string, identity: string): Promise<PunchoutConfig | undefined> {
  const { body } = await apiRoot
    .customObjects()
    .withContainer({ container: CONFIG_CONTAINER })
    .get({ queryArgs: { where: `value(identity = ${str(identity)})`, limit: 5 } })
    .execute();
  return body.results
    .map((o) => parseConfig(o.value))
    .find((c) => c && c.identity === identity && c.domain.toLowerCase() === domain.toLowerCase());
}

// The associate's context in the configured unit; they must still be able to order there.
async function contextFor(config: Pick<PunchoutConfig, "customerId" | "unitKey">): Promise<BuyerContext> {
  const { contexts } = await getCustomerContexts(config.customerId);
  const ctx = contexts.find((c) => c.businessUnitKey === config.unitKey);
  if (!ctx?.canOrder) throw new CxmlError("The configured account can't order for this company", 403);
  return ctx;
}

const carts = (ctx: Pick<PricingContext, "storeKey">) => apiRoot.inStoreKeyWithStoreKeyValue({ storeKey: ctx.storeKey }).carts();

export type OpenRequest = {
  config: PunchoutConfig;
  format: Format;
  returnUrl: string;
  buyerCookie: string;
  buyer: { domain: string; identity: string };
  oci?: PunchoutSession["oci"];
};

// Step 1: a fresh cart and a one-time start URL.
export async function openSession(req: OpenRequest): Promise<string> {
  const ctx = await contextFor(req.config);
  const customer = await apiRoot.customers().withId({ ID: req.config.customerId }).get().execute();
  const { body: cart } = await carts(ctx)
    .post({
      body: {
        currency: ctx.currency,
        ...(ctx.country && { country: ctx.country }),
        customerId: req.config.customerId,
        customerEmail: customer.body.email,
        businessUnit: { typeId: "business-unit", key: ctx.businessUnitKey },
        ...(ctx.supplyChannelId && { inventoryMode: "ReserveOnOrder" as const }),
        shippingAddress: cartAddress(ctx.defaultShippingAddress),
        billingAddress: cartAddress(ctx.defaultBillingAddress),
      },
    })
    .execute();
  const token = randomBytes(32).toString("base64url");
  const session: PunchoutSession = {
    unitKey: ctx.businessUnitKey,
    customerId: req.config.customerId,
    cartId: cart.id,
    format: req.format,
    returnUrl: req.returnUrl,
    buyerCookie: req.buyerCookie,
    buyer: req.buyer,
    supplier: req.config.supplier,
    ...(req.oci && { oci: req.oci }),
    expiresAt: Date.now() + START_TTL_MS,
  };
  await apiRoot
    .customObjects()
    .post({ body: { container: SESSION_CONTAINER, key: hashToken(token), value: session } })
    .execute();
  return `${siteUrl()}/api/punchout/start?token=${token}`;
}

// Step 2: the token works once (deleted at its version, so two parallel redeems can't both win).
export async function redeemStart(token: string): Promise<PunchoutSession | undefined> {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) return undefined;
  const key = hashToken(token);
  const object = await apiRoot
    .customObjects()
    .withContainerAndKey({ container: SESSION_CONTAINER, key })
    .get()
    .execute()
    .then((r) => r.body)
    .catch((err) => (statusOf(err) === 404 ? undefined : Promise.reject(err)));
  if (!object) return undefined;
  const ok = await apiRoot
    .customObjects()
    .withContainerAndKey({ container: SESSION_CONTAINER, key })
    .delete({ queryArgs: { version: object.version } })
    .execute()
    .then(() => true)
    .catch((err) => (statusOf(err) === 409 || statusOf(err) === 404 ? false : Promise.reject(err)));
  const session = object.value as PunchoutSession;
  if (!ok || session.expiresAt < Date.now()) return undefined;
  return { ...session, expiresAt: Date.now() + SESSION_TTL_MS };
}

export async function savePunchout(session: PunchoutSession) {
  (await cookies()).set(PUNCHOUT_COOKIE, sealCookie(PUNCHOUT_COOKIE, session), {
    ...cookieOptions,
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
  });
}

export async function endPunchout() {
  (await cookies()).delete(PUNCHOUT_COOKIE);
}

export async function getPunchout(): Promise<PunchoutSession | undefined> {
  const session = unsealCookie<PunchoutSession>(PUNCHOUT_COOKIE, (await cookies()).get(PUNCHOUT_COOKIE)?.value);
  return session && session.expiresAt > Date.now() ? session : undefined;
}

export class PunchoutError extends Error {}

// The session's cart, if it still belongs to the session's associate and unit and is open.
export async function punchoutCart(session: PunchoutSession): Promise<{ cart: Cart; ctx: BuyerContext }> {
  const ctx = await contextFor(session).catch(() => {
    throw new PunchoutError("Your account can no longer order for this company.");
  });
  const cart = await carts(ctx)
    .withId({ ID: session.cartId })
    .get()
    .execute()
    .then((r) => r.body)
    .catch((err) => (statusOf(err) === 404 ? undefined : Promise.reject(err)));
  if (!cart || cart.customerId !== session.customerId || cart.businessUnit?.key !== session.unitKey || cart.cartState !== "Active") {
    throw new PunchoutError("This PunchOut session has ended. Please start again from your procurement system.");
  }
  return { cart, ctx };
}

async function update(session: PunchoutSession, build: (cart: Cart, ctx: BuyerContext) => CartUpdateAction[]) {
  for (let attempt = 0; ; attempt++) {
    const { cart, ctx } = await punchoutCart(session);
    const actions = build(cart, ctx);
    if (actions.length === 0) return cart;
    try {
      return (
        await carts(ctx)
          .withId({ ID: cart.id })
          .post({ body: { version: cart.version, actions: [...actions, { action: "recalculate", updateProductData: false }] } })
          .execute()
      ).body;
    } catch (err) {
      if (statusOf(err) !== 409 || attempt > 0) throw err;
    }
  }
}

export type AddResult = { added: string[]; problems: string[] };

// "SKU, quantity" lines, priced for the associate's unit; quote-only and unpriced SKUs are refused.
export async function addToPunchoutCart(session: PunchoutSession, input: string): Promise<AddResult> {
  const { lines, errors } = parseQuickOrder(input);
  const problems = errors.map((e) => `Line ${e.line}: ${e.reason}`);
  if (lines.length === 0) return { added: [], problems: problems.length ? problems : ["Enter at least one SKU."] };
  const { ctx } = await punchoutCart(session);
  const found = await lookupSkus(
    ctx,
    lines.map((l) => l.sku),
  );
  const ok = lines.filter((l) => {
    const info = found.get(l.sku);
    if (!info) problems.push(`${l.sku}: not found.`);
    else if (!info.priced) problems.push(`${l.sku}: not sold to your company.`);
    else if (info.quoteOnly) problems.push(`${l.sku}: needs a quote, so it can't be returned to your procurement system.`);
    return info?.priced && !info.quoteOnly;
  });
  if (ok.length > 0) {
    await update(session, (_cart, c) =>
      ok.map((l) => ({
        action: "addLineItem" as const,
        sku: l.sku,
        quantity: l.quantity,
        distributionChannel: { typeId: "channel" as const, id: c.channelId },
        ...(c.supplyChannelId && { supplyChannel: { typeId: "channel" as const, id: c.supplyChannelId } }),
      })),
    );
  }
  return { added: ok.map((l) => l.sku), problems };
}

export async function setPunchoutLine(session: PunchoutSession, lineItemId: string, quantity: number) {
  await update(session, (cart) =>
    cart.lineItems.some((l) => l.id === lineItemId) ? [{ action: "changeLineItemQuantity", lineItemId, quantity }] : [],
  );
}

export type ReturnDocument = { returnUrl: string; fields: [string, string][]; lines: number };

// Step 3: the cart as the procurement system expects it. The session ends (cookie removed) once this is rendered.
export async function returnDocument(session: PunchoutSession): Promise<ReturnDocument> {
  const { cart } = await punchoutCart(session);
  const digits = cart.totalPrice.fractionDigits;
  const lines = cart.lineItems.map((l) => ({
    sku: l.variant.sku ?? "",
    name: localize(l.name),
    quantity: l.quantity,
    unitPrice: decimal(l.price.discounted?.value.centAmount ?? l.price.value.centAmount, digits),
    lineId: l.id,
    currency: cart.totalPrice.currencyCode,
  }));
  if (session.format === "oci") return { returnUrl: session.returnUrl, fields: ociFields(lines, session.oci), lines: lines.length };
  const xml = orderMessage({
    payloadId: `${Date.now()}.${randomBytes(6).toString("hex")}@${new URL(siteUrl()).hostname}`,
    timestamp: new Date().toISOString(),
    buyerCookie: session.buyerCookie,
    from: session.supplier,
    to: session.buyer,
    currency: cart.totalPrice.currencyCode,
    total: decimal(cart.taxedPrice?.totalNet.centAmount ?? cart.totalPrice.centAmount, digits),
    lines,
  });
  return { returnUrl: session.returnUrl, fields: [["cxml-urlencoded", xml]], lines: lines.length };
}

export const summarizeCart = (cart: Cart) =>
  cart.lineItems.map((l) => ({
    id: l.id,
    sku: l.variant.sku ?? "",
    name: localize(l.name),
    quantity: l.quantity,
    unit: l.price.discounted?.value ?? l.price.value,
    total: l.totalPrice,
  }));
