import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { siteUrl } from "@/lib/site-url";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  // Relative canonicals and social image URLs resolve against the configured public URL.
  metadataBase: new URL(siteUrl()),
  title: { default: "Ironline Supply: heavy machines and spare parts", template: "%s | Ironline Supply" },
  description: "Heavy equipment and the spare parts that keep it running: loaders, excavators, cranes, filters, hoses and more.",
  openGraph: { siteName: "Ironline Supply", type: "website" },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>{children}</body>
    </html>
  );
}
