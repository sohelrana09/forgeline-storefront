import { language } from "@/lib/i18n";
import { Analytics } from "@/features/analytics/components/Analytics";
import { analyticsContainer } from "@/features/analytics/config";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "../globals.css";
import { SHARE_IMAGE, siteUrl } from "@/lib/site-url";

// The <html> document every root layout shares. There are several root layouts on purpose: (shop) pages are
// prerendered shells served from the CDN, (private) pages render per request so they can carry a CSP nonce, and the
// Studio is a client app. Moving between them is a full page load.

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  preload: false, // used on few pages: not worth a preload on every one
});

export const rootMetadata: Metadata = {
  // Relative canonicals and social image URLs resolve against the configured public URL.
  metadataBase: new URL(siteUrl()),
  title: { default: "Ironline Supply: heavy machines and spare parts", template: "%s | Ironline Supply" },
  description: "Heavy equipment and the spare parts that keep it running: loaders, excavators, cranes, filters, hoses and more.",
  openGraph: { siteName: "Ironline Supply", type: "website", images: [SHARE_IMAGE] },
  twitter: { card: "summary_large_image" },
};

export function RootDocument({ children }: { children: React.ReactNode }) {
  // The tag manager and its consent banner, only when a container is configured (docs/features/analytics-datalayer.md).
  const container = analyticsContainer();
  return (
    <html lang={language()}>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        {children}
        {container && <Analytics containerId={container} />}
      </body>
    </html>
  );
}
