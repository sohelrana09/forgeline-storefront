import { dateLocale } from "@/lib/i18n";
import type { Cart } from "@commercetools/platform-sdk";
import { reviewers } from "@/features/shared-carts/service";
import { readShare, sharedCartsEnabled } from "@/features/shared-carts/share";
import { ShareCartForm, WithdrawShareButton } from "@/features/shared-carts/components/ShareForms";
import type { BuyerContext } from "@/features/business-units/types";

const when = (iso?: string) =>
  iso ? new Date(iso).toLocaleDateString(dateLocale(), { day: "2-digit", month: "short", year: "numeric" }) : "";

// On the cart page of a business buyer: send the cart to a colleague for review, or see that it is with one.
// Streams in behind a <Suspense>: it reads the unit and its roles live.
export async function SharePanel({ context, cart, customerId }: { context: BuyerContext; cart: Cart; customerId: string }) {
  if (!sharedCartsEnabled() || context.consumer || context.guest) return null;
  const share = readShare(cart.custom);
  const people = await reviewers(context, customerId).catch((err) => {
    console.error("reviewers failed", (err as { body?: unknown })?.body ?? err);
    return [];
  });
  if (share.sharedWith && share.sharedBy === customerId) {
    const name = people.find((p) => p.id === share.sharedWith)?.name ?? "a colleague";
    return (
      <section aria-label="Shared for review" className="flex flex-col gap-2 rounded-md border border-gray-200 bg-white p-4 text-sm">
        <p className="m-0">
          Sent to <strong>{name}</strong> for review {share.sharedAt && `on ${when(share.sharedAt)}`}. They can take it over and order it.
        </p>
        <WithdrawShareButton />
      </section>
    );
  }
  if (people.length === 0) return null;
  return (
    <details className="rounded-md border border-gray-200 bg-white p-4 text-sm">
      <summary className="min-h-11 cursor-pointer content-center font-semibold">Send to a colleague for review</summary>
      <p className="m-0 my-2 text-gray-600">They see your cart, can change it and place the order. We email them a link.</p>
      <ShareCartForm reviewers={people} />
    </details>
  );
}
