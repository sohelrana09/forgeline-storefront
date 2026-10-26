import Link from "next/link";
import { notFound } from "next/navigation";
import { customerApiRoot } from "@/lib/commercetools/client";
import { localize } from "@/features/catalog/utils";
import { orderReference } from "@/features/orders/service";
import { formatMoney } from "@/lib/utils";
import { CartSummary } from "@/features/cart/components/CartSummary";
import { AddressBlock } from "@/features/account/components/AddressBlock";
import type { GuestSession } from "@/features/auth/session";
import type { BuyerContext } from "@/features/business-units/types";

// A guest's order confirmation, read with their own anonymous token (only orders from that guest session exist
// for it). Guests have no order history: this page and the confirmation email are their record.
export async function GuestOrderConfirmation({
  guest,
  context,
  id,
  totalChanged = false,
}: {
  guest?: GuestSession;
  context: BuyerContext;
  id: string;
  totalChanged?: boolean;
}) {
  if (!guest || !/^[0-9a-f-]{36}$/.test(id)) notFound();
  const order = await customerApiRoot(guest.accessToken)
    .inStoreKeyWithStoreKeyValue({ storeKey: context.storeKey })
    .me()
    .orders()
    .withId({ ID: id })
    .get()
    .execute()
    .then((r) => r.body)
    .catch(() => undefined);
  if (!order) notFound();

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-md border border-green-200 bg-green-50 p-5">
        <h1 className="m-0 text-2xl font-bold text-green-900">Thank you for your order</h1>
        <p className="m-0 mt-1 text-sm text-green-900">
          Order {orderReference(order)}
          {order.paymentInfo?.payments.length ? " · paid by card" : " · to pay by bank transfer"} · {order.customerEmail}
        </p>
      </div>
      {totalChanged && (
        <p role="alert" className="m-0 rounded-md border border-amber-200 bg-amber-50 p-4 text-amber-950">
          Your cart changed while you were paying, so this order&apos;s total differs from the one you reviewed. Please check the items, and
          contact us if something isn&apos;t right.
        </p>
      )}
      <div className="flex flex-wrap items-start gap-6">
        <section aria-label="Items" className="min-w-0 flex-[999_1_480px] rounded-md border border-gray-200 bg-white">
          <ul className="m-0 list-none p-0">
            {order.lineItems.map((line) => (
              <li key={line.id} className="flex items-center justify-between gap-4 border-b border-gray-100 p-4 last:border-b-0">
                <div>
                  <div className="font-semibold">{localize(line.name)}</div>
                  <div className="font-mono text-xs text-gray-600">
                    {line.variant.sku} · qty {line.quantity}
                  </div>
                </div>
                <div className="font-semibold">{formatMoney(line.totalPrice)}</div>
              </li>
            ))}
          </ul>
        </section>
        <div className="flex w-full flex-col gap-4 md:max-w-sm md:flex-[1_1_320px]">
          <CartSummary cart={order} title="Totals" />
          <div className="rounded-md border border-gray-200 bg-white p-5 text-sm">
            <h2 className="mb-2 mt-0 text-xs font-semibold uppercase tracking-wide text-gray-600">Delivering to</h2>
            <AddressBlock address={order.shippingAddress} />
          </div>
          <p className="m-0 text-sm text-gray-700">
            <Link href="/register" className="font-semibold text-orange-800">
              Create an account
            </Link>{" "}
            to save your address and see your orders next time.
          </p>
        </div>
      </div>
    </div>
  );
}
