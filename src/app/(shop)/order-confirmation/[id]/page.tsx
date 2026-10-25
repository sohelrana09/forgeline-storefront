import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireBrowseContext } from "@/features/business-units/context";
import { GuestOrderConfirmation } from "@/features/checkout/components/GuestOrderConfirmation";

export const dynamic = "force-dynamic";

// Personal or transactional: never in search results.
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default async function OrderConfirmationPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ changed?: string }>;
}) {
  const [{ id }, { changed }, { session, guest, context }] = await Promise.all([params, searchParams, requireBrowseContext()]);
  // Signed-in customers see their orders in their account.
  if (session) redirect(`/account/orders/${id}`);
  return <GuestOrderConfirmation guest={guest} context={context} id={id} totalChanged={changed === "1"} />;
}
