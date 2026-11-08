import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireBusinessContext } from "@/features/business-units/context";
import { sharedCartsEnabled } from "@/features/shared-carts/share";
import { SharedCartsView } from "@/features/shared-carts/components/SharedCartsView";

export const metadata: Metadata = { title: "Carts shared with me" };

export default async function SharedCartsPage() {
  if (!sharedCartsEnabled()) notFound();
  const { session, context } = await requireBusinessContext();
  return <SharedCartsView session={session} context={context} />;
}
