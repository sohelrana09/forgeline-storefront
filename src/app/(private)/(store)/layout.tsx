import { SiteChrome } from "@/app/_components/SiteChrome";

// Account, cart and order confirmation: the store header and footer, rendered per request like everything in (private).
export default function StoreLayout({ children }: { children: React.ReactNode }) {
  return <SiteChrome>{children}</SiteChrome>;
}
