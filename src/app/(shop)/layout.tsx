import { Suspense } from "react";
import { draftMode } from "next/headers";
import { PreviewEditing } from "@/lib/sanity/PreviewEditing";
import { RootDocument, rootMetadata } from "@/app/_components/RootDocument";
import { SiteChrome } from "@/app/_components/SiteChrome";

export const metadata = rootMetadata;

// Root layout of the catalog, content, blog, search and quick-order pages: a prerendered shell (header, menu,
// footer) served from the CDN; who is visiting (prices, cart, account links) streams in behind <Suspense>.
export default function ShopLayout({ children }: { children: React.ReactNode }) {
  return (
    <RootDocument>
      <SiteChrome>{children}</SiteChrome>
      <Suspense>
        <Preview />
      </Suspense>
    </RootDocument>
  );
}

// Draft mode is on only inside the Studio's Presentation preview: click-to-edit overlays and live refresh.
async function Preview() {
  return (await draftMode()).isEnabled ? <PreviewEditing /> : null;
}
