import type { Metadata } from "next";
import { requireShopContext } from "@/features/business-units/context";
import { InvitationView } from "@/features/company/components/InvitationView";
import { firstParam } from "@/lib/utils";

export const dynamic = "force-dynamic";

// The code is a one-time secret: keep it out of Referer headers.
export const metadata: Metadata = { title: "Company invitation", referrer: "no-referrer" };

export default async function InvitationPage({ searchParams }: { searchParams: Promise<{ code?: string | string[] }> }) {
  const [{ code }, { session }] = await Promise.all([searchParams, requireShopContext()]);
  return <InvitationView session={session} code={firstParam(code) ?? ""} />;
}
