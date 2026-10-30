import type { Metadata } from "next";
import { connection } from "next/server";
import { RootDocument, rootMetadata } from "@/app/_components/RootDocument";

// Root layout of the account, cart, checkout, order confirmation and sign-in pages. They render fully per request,
// with no prerendered shell: src/proxy.ts gives them a fresh CSP nonce, which Next can only put on scripts it renders
// for that request. Never in search results.
export const metadata: Metadata = { ...rootMetadata, robots: { index: false, follow: false } };

// Allowed to block: nothing here is prerendered.
export const instant = false;

export default async function PrivateLayout({ children }: { children: React.ReactNode }) {
  await connection();
  return <RootDocument>{children}</RootDocument>;
}
