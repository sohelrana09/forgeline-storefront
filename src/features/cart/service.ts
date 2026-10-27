import "server-only";
import { cache } from "react";
import type { BaseAddress, Cart, MyCartUpdateAction, ProductVariant, ShippingMethod, TypedMoney } from "@commercetools/platform-sdk";
import { apiRoot, customerApiRoot } from "@/lib/commercetools/client";
import type { PricingContext } from "@/features/business-units/types";
import type { QuickOrderLine } from "@/features/quick-order/types";
import { signOutOnAuthError } from "@/features/auth/session";
import { isQuoteOnly } from "@/features/catalog/utils";

// The token for "my carts": a signed-in buyer's session or a guest's anonymous token.
export type CartAuth = { accessToken: string };

export type SkuInfo = {
  sku: string;
  name: string;
  priced: boolean;
  quoteOnly: boolean;
  // For lists that show products (purchase lists): the selected price (discounted if a discount applies), page, picture.
  price?: TypedMoney;
  slug?: string;
  image?: string;
};

// One query for all SKUs, with the business unit's store and price selection applied.
// SKUs are validated by parseQuickOrder to [A-Za-z0-9._-], so quoting them into the predicate is safe.
export async function lookupSkus(context: PricingContext, skus: string[]): Promise<Map<string, SkuInfo>> {
  const found = new Map<string, SkuInfo>();
  if (skus.length === 0) return found;

  const list = skus.map((s) => `"${s}"`).join(", ");
  const { body } = await apiRoot
    .productProjections()
    .get({
      queryArgs: {
        where: `masterVariant(sku in (${list})) or variants(sku in (${list}))`,
        limit: 500,
        storeProjection: context.storeKey,
        priceCurrency: context.currency,
        priceChannel: context.channelId,
        ...(context.country && { priceCountry: context.country }),
      },
    })
    .execute();

  for (const product of body.results) {
    const name = product.name["en-US"] ?? Object.values(product.name)[0];
    const variants: ProductVariant[] = [product.masterVariant, ...product.variants];
    for (const v of variants) {
      if (v.sku && skus.includes(v.sku)) {
        found.set(v.sku, {
          sku: v.sku,
          name,
          priced: Boolean(v.price),
          quoteOnly: isQuoteOnly(v.price),
          price: v.price?.discounted?.value ?? v.price?.value,
          slug: product.slug["en-GB"] ?? Object.values(product.slug)[0],
          image: v.images?.[0]?.url ?? product.masterVariant.images?.[0]?.url,
        });
      }
    }
  }
  return found;
}

// The signed-in buyer's (or guest's) own carts in this store, with their narrowed token (manage_my_orders:<project>:<store>).
// /as-associate would need project-wide view_orders/manage_orders on the customer token, which also unlocks
// every customer's carts and orders, so it is deliberately not used.
const myCarts = (session: CartAuth, context: PricingContext) =>
  customerApiRoot(session.accessToken).inStoreKeyWithStoreKeyValue({ storeKey: context.storeKey }).me().carts();

const statusOf = (err: unknown) => (err as { body?: { statusCode?: number } })?.body?.statusCode;

// One read per page render (React cache): the header and the cart or checkout page share it.
export const getActiveCart = cache(async (session: CartAuth, cartId: string | undefined, context: PricingContext) => {
  if (!cartId) return undefined;
  const cart = await myCarts(session, context)
    .withId({ ID: cartId })
    .get()
    .execute()
    .then((r) => r.body)
    .catch((err) => {
      // Not found (or not this customer's) → start a new cart; 401 → signed out; anything else must not orphan it.
      // A guest (empty unit key) with a revoked token just has no cart: there is no session to end.
      if (statusOf(err) === 404 || (statusOf(err) === 401 && !context.businessUnitKey)) return undefined;
      return signOutOnAuthError(err);
    });
  // A cart only counts if it is still open and belongs to the currently selected business unit
  // (the guest context has the empty key, and guest carts have no business unit).
  return cart?.cartState === "Active" && (cart.businessUnit?.key ?? "") === context.businessUnitKey ? cart : undefined;
});

const lineDraft = (context: PricingContext, { sku, quantity }: QuickOrderLine) => ({
  sku,
  quantity,
  distributionChannel: { typeId: "channel" as const, id: context.channelId },
});

// Cart addresses are copies: drop the business unit address's own id/key.
export const cartAddress = (address?: BaseAddress): BaseAddress | undefined => {
  if (!address) return undefined;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { id, key, ...rest } = address;
  return rest;
};

export type ShippingOption = {
  key: string;
  name: string;
  price?: { centAmount: number; currencyCode: string; fractionDigits: number };
  freeAbove?: { centAmount: number; currencyCode: string; fractionDigits: number };
  isDefault: boolean;
};

// Methods that ship to this address in this currency (admin read; the customer token can't see them).
export async function getShippingOptions(ctx: PricingContext, address?: BaseAddress): Promise<ShippingOption[]> {
  if (!address?.country) return [];
  const { body } = await apiRoot
    .shippingMethods()
    .matchingLocation()
    .get({
      queryArgs: { country: address.country, ...(address.state && { state: address.state }), currency: ctx.currency },
    })
    .execute();
  return body.results.flatMap((m: ShippingMethod) => {
    const rate = m.zoneRates.flatMap((z) => z.shippingRates).find((r) => r.isMatching ?? r.price.currencyCode === ctx.currency);
    if (!m.key || !rate) return [];
    return [{ key: m.key, name: m.name, price: rate.price, freeAbove: rate.freeAbove, isDefault: m.isDefault }];
  });
}

// Applies actions built from the CURRENT cart; on a version conflict re-reads it and rebuilds once.
export async function updateMyCart(
  session: CartAuth,
  context: PricingContext,
  cart: Cart,
  buildActions: (cart: Cart) => MyCartUpdateAction[],
): Promise<Cart> {
  const update = (c: Cart) =>
    myCarts(session, context)
      .withId({ ID: c.id })
      .post({ body: { version: c.version, actions: buildActions(c) } })
      .execute()
      .then((r) => r.body);
  try {
    return await update(cart);
  } catch (err) {
    if (statusOf(err) !== 409) throw err;
    const fresh = await getActiveCart(session, cart.id, context);
    if (!fresh) throw err;
    return update(fresh);
  }
}

// Adds all lines in ONE cart update (creating the cart if needed). Retries once on a version conflict.
export async function addLinesToCart(
  session: CartAuth,
  cartId: string | undefined,
  context: PricingContext,
  lines: QuickOrderLine[],
): Promise<Cart> {
  const existing = await getActiveCart(session, cartId, context);
  if (!existing) {
    // The buyer's own cart in that unit; commercetools rejects a business unit they're not an associate of.
    // Starting with the unit's default address and default shipping method means tax and shipping show from line one.
    const defaultMethod = (await getShippingOptions(context, context.defaultShippingAddress)).find((o) => o.isDefault);
    const { body } = await myCarts(session, context)
      .post({
        body: {
          currency: context.currency,
          ...(context.country && { country: context.country }),
          ...(context.businessUnitKey && {
            businessUnit: { typeId: "business-unit" as const, key: context.businessUnitKey },
          }),
          shippingAddress: cartAddress(context.defaultShippingAddress),
          billingAddress: cartAddress(context.defaultBillingAddress),
          ...(defaultMethod && { shippingMethod: { typeId: "shipping-method" as const, key: defaultMethod.key } }),
          lineItems: lines.map((l) => lineDraft(context, l)),
        },
      })
      .execute()
      .catch(signOutOnAuthError);
    return body;
  }
  return updateMyCart(session, context, existing, () =>
    lines.map((l): MyCartUpdateAction => ({ action: "addLineItem", ...lineDraft(context, l) })),
  );
}

// Quantity 0 removes the line. Line ids come from the form but only ever address this buyer's own cart.
export async function setLineQuantity(session: CartAuth, context: PricingContext, cart: Cart, lineItemId: string, quantity: number) {
  return updateMyCart(session, context, cart, (c) =>
    c.lineItems.some((l) => l.id === lineItemId)
      ? [quantity > 0 ? { action: "changeLineItemQuantity", lineItemId, quantity } : { action: "removeLineItem", lineItemId }]
      : [],
  );
}

export type MergeResult = { cart?: Cart; merged: number; skipped: string[] };

// Sign-in merge: the guest cart's lines go into the buyer's cart for the selected unit, re-priced
// for that unit (its store, channel and currency), and the guest cart is deleted. SKUs the unit's store doesn't
// sell are reported, not added. Merging is not commercetools' own anonymous-cart merge: that one knows nothing
// about business units or stores, so the lines are re-added here instead.
export async function mergeGuestCart(
  guest: CartAuth & { cartId?: string },
  guestContext: PricingContext,
  buyer: CartAuth,
  buyerCartId: string | undefined,
  context: PricingContext & { consumer?: boolean },
): Promise<MergeResult> {
  const guestCart = await getActiveCart(guest, guest.cartId, guestContext);
  if (!guestCart || guestCart.lineItems.length === 0) return { merged: 0, skipped: [] };

  const lines = guestCart.lineItems.flatMap((l) => (l.variant.sku ? [{ sku: l.variant.sku, quantity: l.quantity }] : []));
  const skus = await lookupSkus(
    context,
    lines.map((l) => l.sku),
  );
  // Consumers can't request quotes, so machines (quote only) are left out for them.
  const fits = (sku: string) => skus.get(sku)?.priced && !(context.consumer && skus.get(sku)?.quoteOnly);
  const addable = lines.filter((l) => fits(l.sku));
  const skipped = lines.filter((l) => !fits(l.sku)).map((l) => l.sku);

  // Add first, delete after: a failed add leaves the guest cart intact for the next sign-in.
  const cart = addable.length > 0 ? await addLinesToCart(buyer, buyerCartId, context, addable) : undefined;
  await myCarts(guest, guestContext)
    .withId({ ID: guestCart.id })
    .delete({ queryArgs: { version: guestCart.version } })
    .execute()
    .catch((err) => console.error("guest cart delete failed", (err as { body?: unknown })?.body ?? err));
  return { cart, merged: addable.length, skipped };
}
