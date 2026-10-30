import { Suspense } from "react";
import type { Metadata } from "next";
import { requireBrowseContext } from "@/features/business-units/context";
import { HomeView } from "@/features/catalog/components/HomeView";
import { PageSkeleton } from "@/components/ui/PageSkeleton";

export const metadata: Metadata = { alternates: { canonical: "/" } };

// The shell (header, footer) is prerendered; the home content depends on the visitor's prices and streams in.
export default function HomePage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Home />
    </Suspense>
  );
}

async function Home() {
  const { context } = await requireBrowseContext();
  return <HomeView context={context} />;
}
