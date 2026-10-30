import type { Metadata } from "next";
import { SiteChrome } from "@/app/_components/SiteChrome";

// Sign-in, sign-up and password pages: never in search results (robots.txt disallows them too, but a disallowed URL
// can still be indexed from links without noindex).
export const metadata: Metadata = { robots: { index: false, follow: false } };

// Same header and footer as the shop: customer pages keep the store chrome.
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <SiteChrome lenient>{children}</SiteChrome>;
}
