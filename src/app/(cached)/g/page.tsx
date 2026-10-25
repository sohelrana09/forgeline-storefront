import type { Metadata } from "next";
import { getGuestContext } from "@/features/business-units/service";
import { HomeView } from "@/features/catalog/components/HomeView";

// Cached guest home page (see the layout). "error": the build fails if anything here reads cookies or headers.
export const revalidate = 300;
export const dynamic = "error";

export const metadata: Metadata = { alternates: { canonical: "/" } };

export default async function CachedHomePage() {
  return <HomeView context={await getGuestContext()} />;
}
