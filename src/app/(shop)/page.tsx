import type { Metadata } from "next";
import { requireBrowseContext } from "@/features/business-units/context";
import { HomeView } from "@/features/catalog/components/HomeView";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { alternates: { canonical: "/" } };

export default async function HomePage() {
  const { session, context } = await requireBrowseContext();
  return <HomeView session={session} context={context} />;
}
