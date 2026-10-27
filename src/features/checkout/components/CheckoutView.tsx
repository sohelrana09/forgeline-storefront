import Link from "next/link";
import { redirect } from "next/navigation";
import { getActiveCart } from "@/features/cart/service";
import { getMe, withMyAddresses } from "@/features/account/service";
import { ResendVerificationButton } from "@/features/auth/components/AccountForms";
import { getShippingOptions, orderFromCart, quoteOnlyLines } from "@/features/checkout/service";
import { addressLabel, methodOptions } from "@/features/checkout/utils";
import { CartSummary } from "@/features/cart/components/CartSummary";
import { DeliveryForm } from "@/features/checkout/components/CheckoutForm";
import { CheckoutItems } from "@/features/checkout/components/CheckoutItems";
import { CheckoutStep } from "@/features/checkout/components/CheckoutStep";
import { PaymentStep } from "@/features/checkout/components/PaymentStep";
import { CheckoutStatusProvider } from "@/features/checkout/components/CheckoutStatus";
import { cardPaymentsEnabled } from "@/lib/commercetools/checkout-session";
import type { Session } from "@/features/auth/session";
import type { BuyerContext } from "@/features/business-units/types";
import { Message } from "@/components/ui/Message";

// One-step checkout for signed-in customers: 1 Shipping address, 2 Shipping methods,
// 3 Payment method with Place order, and the order summary beside them.
export async function CheckoutView({
  session,
  context: shopContext,
  cartId,
}: {
  session: Session;
  context: BuyerContext;
  cartId?: string;
}) {
  if (!shopContext.canOrder) redirect("/cart");
  const [cart, context, me] = await Promise.all([
    getActiveCart(session, cartId, shopContext),
    withMyAddresses(session, shopContext),
    shopContext.consumer ? getMe(session) : undefined,
  ]);
  if (!cart && cartId) {
    // Paid, but the success callback never arrived (closed tab): the cart became an order. Show that order.
    const order = await orderFromCart(session, shopContext, cartId);
    if (order) redirect(`/account/orders/${order.id}`);
  }
  if (!cart || cart.lineItems.length === 0 || quoteOnlyLines(cart).length > 0) redirect("/cart");

  // The cart's address is a copy; match it back to the saved address by its fields.
  const selected =
    context.addresses.find(
      (a) =>
        a.country === cart.shippingAddress?.country &&
        a.city === cart.shippingAddress?.city &&
        a.streetName === cart.shippingAddress?.streetName,
    ) ?? context.defaultShippingAddress;
  const options = selected ? await getShippingOptions(context, selected) : [];
  const methodKey = options.find((o) => o.name === cart.shippingInfo?.shippingMethodName)?.key;
  const shippingMethodSet = Boolean(cart.shippingInfo);
  const emailOk = !context.consumer || Boolean(me?.isEmailVerified);
  const ready = shippingMethodSet && Boolean(cart.taxedPrice) && emailOk;
  const billing = context.defaultBillingAddress
    ? addressLabel(context.defaultBillingAddress)
    : context.consumer
      ? "Same as the shipping address"
      : "Your company's billing address";

  return (
    <div className="flex flex-col gap-6">
      <h1 className="m-0 text-2xl font-bold">Checkout</h1>
      <div className="flex flex-wrap items-start gap-6">
        <CheckoutStatusProvider>
          <div className="flex min-w-0 flex-[999_1_480px] flex-col gap-6">
            {context.addresses.length === 0 ? (
              // A consumer without a saved address adds one first (the address book form handles validation and countries).
              <CheckoutStep step={1} title="Shipping address">
                {context.consumer ? (
                  <>
                    <p className="m-0 text-sm text-gray-700">Add a delivery address to your address book, then come back here.</p>
                    <Link
                      href="/account/addresses#add-address"
                      className="self-start rounded bg-orange-700 px-5 py-3 font-semibold text-white no-underline hover:bg-orange-800"
                    >
                      + New address
                    </Link>
                  </>
                ) : (
                  // Company addresses belong to the business unit: only our sales team or a company admin can add them.
                  <p className="m-0 text-sm text-gray-700">
                    Your company account has no delivery address yet. Please ask your company administrator or our sales team to add one.
                  </p>
                )}
              </CheckoutStep>
            ) : (
              <DeliveryForm
                addresses={context.addresses.filter((a) => a.id).map((a) => ({ key: a.id!, label: addressLabel(a) }))}
                addressId={selected?.id}
                methods={methodOptions(options, cart)}
                methodKey={methodKey}
                addAddressHref={context.consumer ? "/account/addresses#add-address" : undefined}
              />
            )}
            {!emailOk && me && (
              <Message type="warning">
                <p className="m-0">Please confirm your email address ({me.email}) before placing your order.</p>
                <ResendVerificationButton />
              </Message>
            )}
            <PaymentStep
              kind={context.consumer ? (cardPaymentsEnabled() ? "card" : "bank-transfer") : "invoice"}
              billing={billing}
              cartVersion={cart.version}
              purchaseOrderNumber={cart.purchaseOrderNumber}
              ready={ready}
              waitingFor={shippingMethodSet ? undefined : "Choose a shipping method first."}
            />
          </div>
        </CheckoutStatusProvider>

        <aside aria-label="Order summary" className="flex w-full flex-col gap-4 md:sticky md:top-4 md:max-w-sm md:flex-[1_1_320px]">
          <CartSummary cart={cart} title="Order summary" />
          <CheckoutItems cart={cart} />
        </aside>
      </div>
    </div>
  );
}
