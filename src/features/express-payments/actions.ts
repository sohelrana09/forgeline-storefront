"use server";

// Public endpoints behind the wallet sheet's callbacks. Each one: the switch, the caller's own B2C cart (consumer or
// guest) read with their own token, a rate limit, validation of what the wallet sent, then the service.

import { unstable_rethrow } from "next/navigation";
import { clientIp, tooManyAttempts } from "@/lib/rate-limit";
import { AUTOMATED_MESSAGE, isAutomated } from "@/lib/bot-check";
import { checkoutPaymentsEnabled, type CheckoutSession } from "@/lib/commercetools/checkout-session";
import { actorKey, requireBrowseContext } from "@/features/business-units/context";
import { getMe } from "@/features/account/service";
import { CheckoutError } from "@/features/checkout/service";
import { expressEnabled, fullAddress, partialAddress, walletEmail } from "@/features/express-payments/express";
import {
  expressShippingMethods,
  prepareExpress,
  setExpressAddress,
  setExpressMethod,
  submitExpress,
} from "@/features/express-payments/service";

type Result<T> = { ok: true; value: T } | { ok: false; error: string };

async function caller(limit: string, max: number) {
  if (!expressEnabled() || !checkoutPaymentsEnabled()) throw new CheckoutError("Express payment is not available.");
  const browse = await requireBrowseContext();
  const { auth, context, cartId } = browse;
  if (!auth || !cartId || !(context.consumer || context.guest)) throw new CheckoutError("Your cart is no longer open.");
  if (
    (await tooManyAttempts(`express-${limit}:${actorKey(browse)}`, max)) ||
    (await tooManyAttempts(`express-ip:${await clientIp()}`, max * 3))
  ) {
    throw new CheckoutError("Too many attempts. Please wait a few minutes and try again.");
  }
  return { ...browse, auth, cartId };
}

async function run<T>(work: () => Promise<T>): Promise<Result<T>> {
  try {
    return { ok: true, value: await work() };
  } catch (err) {
    unstable_rethrow(err);
    if (err instanceof CheckoutError) return { ok: false, error: err.message };
    console.error("express payment failed", (err as { body?: unknown })?.body ?? (err as Error).message);
    return { ok: false, error: "Express payment is unavailable right now. Please use the checkout." };
  }
}

export async function startExpressPayment(): Promise<
  Result<{
    session: CheckoutSession;
    countryCode: string;
    initialAmount: { centAmount: number; currencyCode: string; fractionDigits: number };
  }>
> {
  return run(async () => {
    if (await isAutomated()) throw new CheckoutError(AUTOMATED_MESSAGE);
    const { session, auth, context, cartId } = await caller("start", 20);
    if (context.consumer && session && !(await getMe(session)).isEmailVerified) {
      throw new CheckoutError("Please confirm your email address first: use the link we sent you.");
    }
    return prepareExpress(auth, context, cartId);
  });
}

export async function expressAddressAction(address: unknown) {
  return run(async () => {
    const { auth, context, cartId } = await caller("change", 60);
    const partial = partialAddress((address ?? {}) as Record<string, unknown>);
    if (!partial) throw new CheckoutError("We don't deliver to that country.");
    await setExpressAddress(auth, context, cartId, partial);
  });
}

export async function expressMethodsAction() {
  return run(async () => {
    const { auth, context, cartId } = await caller("change", 60);
    return expressShippingMethods(auth, context, cartId);
  });
}

export async function expressMethodAction(key: unknown) {
  return run(async () => {
    if (typeof key !== "string" || !/^[A-Za-z0-9_-]{1,100}$/.test(key)) throw new CheckoutError("Choose a delivery method.");
    const { auth, context, cartId } = await caller("change", 60);
    await setExpressMethod(auth, context, cartId, key);
  });
}

export async function expressSubmitAction(
  sessionId: unknown,
  details: { shippingAddress?: unknown; billingAddress?: unknown; customerEmail?: unknown },
) {
  return run(async () => {
    if (typeof sessionId !== "string" || !/^[A-Za-z0-9_-]{1,100}$/.test(sessionId)) throw new CheckoutError("The payment is out of date.");
    const { auth, context, cartId } = await caller("submit", 20);
    const shipping = fullAddress((details?.shippingAddress ?? {}) as Record<string, unknown>);
    const billing = fullAddress((details?.billingAddress ?? details?.shippingAddress ?? {}) as Record<string, unknown>);
    if (!shipping || !billing) throw new CheckoutError("Your wallet didn't share a full delivery address.");
    // Guests order under the wallet's email; a signed-in consumer keeps their own.
    const email = context.guest ? walletEmail(details?.customerEmail) : undefined;
    if (context.guest && !email) throw new CheckoutError("Your wallet didn't share an email address.");
    return submitExpress(auth, context, cartId, sessionId, { shipping, billing, email });
  });
}
