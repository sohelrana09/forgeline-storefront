import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { BU_COOKIE, SESSION_COOKIE, cartCookie, getGuest, getSession, type GuestSession, type Session } from "@/features/auth/session";
import {
  forgetBuyingContexts,
  getBuyingContexts,
  getConsumerContext,
  getGuestContext,
  isAssociateNow,
} from "@/features/business-units/service";
import type { BuyerContext, BuyingContext } from "@/features/business-units/types";

// Business units where this customer is an associate (explicit or inherited), with their buyer flag.
export function contextsFor(all: BuyingContext[], customerId: string): BuyerContext[] {
  return all.flatMap(({ members, ...c }) => {
    // A customer can be listed twice (explicit + inherited): merge their roles and permissions.
    const self = members.filter((m) => m.customerId === customerId);
    if (self.length === 0) return [];
    return [
      {
        ...c,
        canOrder: self.some((m) => m.roles.includes("buyer")),
        permissions: [...new Set(self.flatMap((m) => m.permissions))],
      },
    ];
  });
}

export const pickContext = (contexts: BuyerContext[], selectedKey: string | undefined) =>
  contexts.find((c) => c.businessUnitKey === selectedKey) ?? contexts[0];

// The customer id comes from /me at login and lives in the encrypted session, so the ct_bu cookie only picks among
// the customer's own units.
// Wrapped in React cache(): the layout, the page and its actions share one lookup per request.
export const currentBuyingContext = cache(async () => {
  const session = await getSession();
  if (!session) return undefined;

  // No /me round trip per request: expiry is in the session, and a revoked token surfaces as a 401 on the
  // first customer call (cart, orders), which goes through signOutOnAuthError.
  let contexts = contextsFor(await getBuyingContexts(), session.customerId);
  if (contexts.length === 0 && (await isAssociateNow(session.customerId))) {
    // An associate the memo doesn't know yet: reload once. Still nothing means their unit can't be shopped
    // (e.g. its store has no price channel): that's /no-access, never a silent switch to consumer prices.
    forgetBuyingContexts();
    contexts = contextsFor(await getBuyingContexts(), session.customerId);
    if (contexts.length === 0) redirect("/no-access");
  }
  const jar = await cookies();
  // Not an associate of any unit: a consumer (B2C) customer, with a personal cart in the B2C store.
  const context = contexts.length > 0 ? pickContext(contexts, jar.get(BU_COOKIE)?.value) : await getConsumerContext(session.customerId);
  return { session, contexts, context, cartId: jar.get(cartCookie(context.businessUnitKey))?.value };
});

// Pages and actions open to guests (catalog, cart): a signed-in buyer's context, or the guest context.
// `auth` is the token for "my carts": the buyer's, or the guest's (undefined until the guest adds a first line).
export type BrowseContext = {
  session?: Session;
  guest?: GuestSession;
  contexts: BuyerContext[];
  context: BuyerContext;
  cartId?: string;
  auth?: { accessToken: string };
};

export const currentBrowseContext = cache(async (): Promise<BrowseContext> => {
  const buyer = await currentBuyingContext();
  if (buyer) return { ...buyer, auth: buyer.session };
  // An expired or unreadable session must not quietly turn the buyer into a guest: /logout clears it and asks to sign in.
  if ((await cookies()).has(SESSION_COOKIE)) redirect("/logout");
  const [guest, context] = await Promise.all([getGuest(), getGuestContext()]);
  return { guest, contexts: [], context, cartId: guest?.cartId, auth: guest };
});

export const requireBrowseContext = (): Promise<BrowseContext> => currentBrowseContext();

// Signed-in only pages and actions (checkout, orders, account), for business buyers and consumers alike.
// A layout redirect alone is not a security boundary.
export async function requireShopContext() {
  const current = await currentBuyingContext();
  if (!current) redirect("/login");
  return current;
}

// Business-only pages and actions (quotes, company administration): consumers go to their account instead.
export async function requireBusinessContext() {
  const current = await requireShopContext();
  if (current.context.consumer) redirect("/account");
  return current;
}
