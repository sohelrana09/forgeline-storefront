import Link from "next/link";
import { redirect } from "next/navigation";
import { getActiveCart } from "@/features/cart/service";
import { getShippingOptions, orderFromCart, quoteOnlyLines } from "@/features/checkout/service";
import { CONSUMER_COUNTRIES } from "@/features/business-units/service";
import { countryName } from "@/features/account/utils";
import { CartSummary } from "@/features/cart/components/CartSummary";
import { CheckoutItems } from "@/features/checkout/components/CheckoutItems";
import { PaymentStep } from "@/features/checkout/components/PaymentStep";
import { CheckoutStatusProvider } from "@/features/checkout/components/CheckoutStatus";
import { addressLabel, methodOptions } from "@/features/checkout/utils";
import { cardPaymentsEnabled } from "@/lib/commercetools/checkout-session";
import { GuestDetailsForm } from "@/features/checkout/components/GuestDetailsForm";
import type { GuestSession } from "@/features/auth/session";
import type { BuyerContext } from "@/features/business-units/types";

const countries = CONSUMER_COUNTRIES.map((code) => ({ code, name: countryName(code) })).sort((a, b) => a.name.localeCompare(b.name));

// One-step checkout without an account (B2C), laid out like Magento's: 1 Shipping address with email, 2 Shipping
// methods, 3 Payment method with Place order.
export async function GuestCheckoutView({ guest, context, cartId }: { guest?: GuestSession; context: BuyerContext; cartId?: string }) {
  const cart = guest && (await getActiveCart(guest, cartId, context));
  if (guest && cartId && !cart) {
    // Paid, but the success callback never arrived (closed tab): the cart became an order. Show that order.
    const order = await orderFromCart(guest, context, cartId);
    if (order) redirect(`/order-confirmation/${order.id}`);
  }
  // Machines are sold to business customers on quote: the cart page explains that.
  if (!cart || cart.lineItems.length === 0 || quoteOnlyLines(cart).length > 0) redirect("/cart");

  // Delivery methods for the address on the cart (or the first delivery country until the guest enters one).
  const options = await getShippingOptions(context, cart.shippingAddress ?? { country: countries[0].code });
  const ready = Boolean(cart.shippingInfo && cart.taxedPrice && cart.customerEmail);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <h1 className="m-0 text-2xl font-bold">Checkout</h1>
        <p className="m-0 text-sm text-gray-700">
          Have an account?{" "}
          <Link href="/login" className="font-semibold text-orange-800">
            Sign in
          </Link>{" "}
          to use your saved addresses.
        </p>
      </div>
      <div className="flex flex-wrap items-start gap-6">
        <CheckoutStatusProvider>
          <div className="flex min-w-0 flex-[999_1_480px] flex-col gap-6">
            <GuestDetailsForm
              email={cart.customerEmail}
              address={cart.shippingAddress}
              countries={countries}
              methods={methodOptions(options, cart)}
              methodKey={options.find((o) => o.name === cart.shippingInfo?.shippingMethodName)?.key}
            />
            <PaymentStep
              kind={cardPaymentsEnabled() ? "card" : "bank-transfer"}
              billing={
                cart.shippingAddress
                  ? `Same as the shipping address\n${addressLabel(cart.shippingAddress)}`
                  : "Same as the shipping address"
              }
              cartVersion={cart.version}
              ready={ready}
              waitingFor={ready ? undefined : "Save your shipping address and method first."}
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
