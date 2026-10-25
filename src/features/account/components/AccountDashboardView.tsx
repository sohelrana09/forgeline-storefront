import Link from "next/link";
import { getMe } from "@/features/account/service";
import { ResendVerificationButton } from "@/features/auth/components/AccountForms";
import { listMyOrders } from "@/features/orders/service";
import { countAwaitingQuotes } from "@/features/quotes/service";
import { OrdersTable } from "@/features/orders/components/OrdersTable";
import { AddressBlock } from "@/features/account/components/AddressBlock";
import { Panel, PanelBox } from "@/features/account/components/Panel";
import type { Session } from "@/features/auth/session";
import type { BuyerContext } from "@/features/business-units/types";

// Magento's "My Account" dashboard: account information, address book, recent orders, plus quotes waiting for a decision.
export async function AccountDashboardView({
  session,
  context,
  emailNotice,
}: {
  session: Session;
  context: BuyerContext;
  emailNotice?: "verified" | "invalid";
}) {
  const [me, orders, awaiting] = await Promise.all([
    getMe(session),
    listMyOrders(session, context, 5),
    context.consumer ? 0 : countAwaitingQuotes(session, context),
  ]);
  // Consumers' addresses are their own; business buyers see the company's defaults.
  const byId = (id?: string) => me.addresses.find((a) => a.id === id);
  const billing = context.consumer ? byId(me.defaultBillingAddressId) : context.defaultBillingAddress;
  const shipping = context.consumer ? byId(me.defaultShippingAddressId) : context.defaultShippingAddress;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="m-0 text-2xl font-bold">My account</h1>

      {emailNotice === "verified" && (
        <p role="status" className="m-0 rounded-md border border-green-200 bg-green-50 p-4 text-sm text-green-900">
          Thank you. Your email address is confirmed.
        </p>
      )}
      {emailNotice === "invalid" && (
        <p role="alert" className="m-0 rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
          That confirmation link has expired or was already used.
        </p>
      )}
      {!emailNotice && !me.isEmailVerified && (
        <p className="m-0 rounded-md border border-gray-200 bg-white p-4 text-sm text-gray-700">
          Please confirm your email address with the link we sent to {me.email}. <ResendVerificationButton />
        </p>
      )}

      {awaiting > 0 && (
        <p role="status" className="m-0 rounded-md border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
          {awaiting === 1 ? "1 quote is" : `${awaiting} quotes are`} waiting for your decision.{" "}
          <Link href="/account/quotes" className="font-semibold text-amber-950">
            View quotes
          </Link>
        </p>
      )}

      <Panel title="Account information">
        <PanelBox title="Contact information" action={{ href: "/account/information", label: "Edit" }}>
          <p className="m-0">{[me.firstName, me.lastName].filter(Boolean).join(" ") || "No name set"}</p>
          <p className="m-0 text-gray-700">{me.email}</p>
        </PanelBox>
        {context.consumer ? (
          <PanelBox title="Account type">
            <p className="m-0">Personal account</p>
            <p className="m-0 text-gray-700">Prices in {context.currency}, VAT included</p>
            <p className="m-0 text-gray-700">Buying for a business? Ask our sales team for a company account.</p>
          </PanelBox>
        ) : (
          <PanelBox title="Company">
            <p className="m-0">{context.businessUnitName}</p>
            <p className="m-0 text-gray-700">
              {context.storeName} · {context.currency}
            </p>
            <p className="m-0 text-gray-700">
              {context.canOrder ? "You can place orders and request quotes." : "View only: you can't place orders."}
            </p>
          </PanelBox>
        )}
      </Panel>

      <Panel title="Address book" action={{ href: "/account/addresses", label: "Manage addresses" }}>
        <PanelBox title="Default billing address">
          <AddressBlock address={billing} />
        </PanelBox>
        <PanelBox title="Default shipping address">
          <AddressBlock address={shipping} />
        </PanelBox>
      </Panel>

      <section aria-labelledby="recent-orders" className="rounded-md border border-gray-200 bg-white">
        <div className="flex items-baseline justify-between gap-4 border-b border-gray-200 px-5 py-4">
          <h2 id="recent-orders" className="m-0 text-lg font-semibold">
            Recent orders
          </h2>
          <Link href="/account/orders" className="text-sm text-orange-800">
            View all
          </Link>
        </div>
        {orders.length === 0 ? (
          <p className="m-0 p-5 text-sm text-gray-600">
            You have placed no orders{context.consumer ? "" : ` for ${context.businessUnitName}`} yet.
          </p>
        ) : (
          <OrdersTable orders={orders} canOrder={context.canOrder} />
        )}
      </section>
    </div>
  );
}
