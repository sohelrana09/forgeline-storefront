import type { Metadata } from "next";
import { requireBrowseContext } from "@/features/business-units/context";
import { CheckoutView } from "@/features/checkout/components/CheckoutView";
import { GuestCheckoutView } from "@/features/checkout/components/GuestCheckoutView";
import { Message } from "@/components/ui/Message";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { robots: { index: false, follow: false } };

// Signed-in customers (business buyers and consumers) use their saved addresses; guests enter theirs.
export default async function CheckoutPage({ searchParams }: { searchParams: Promise<{ payment?: string }> }) {
  const [{ session, guest, context, cartId }, { payment }] = await Promise.all([requireBrowseContext(), searchParams]);
  return (
    <div className="flex flex-col gap-4">
      {payment === "unconfirmed" && (
        <Message type="warning">
          We couldn&apos;t confirm your order yet. If your card was charged, your order confirmation email has the details: please contact
          us before paying again.
        </Message>
      )}
      {session ? (
        <CheckoutView session={session} context={context} cartId={cartId} />
      ) : (
        <GuestCheckoutView guest={guest} context={context} cartId={cartId} />
      )}
    </div>
  );
}
