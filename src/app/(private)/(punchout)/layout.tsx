import type { Metadata } from "next";
import { SiteLogo } from "@/components/layouts/SiteLogo";
import { PageMessages } from "@/components/ui/PageMessages";

export const metadata: Metadata = { robots: { index: false, follow: false } };

// PunchOut: the buyer came from their procurement system and goes back there with the cart; no account links,
// menu or checkout.
export default function PunchoutLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-100 text-gray-800">
      <header className="bg-gray-900 text-gray-50">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-8">
          <SiteLogo />
          <span className="text-sm text-gray-300">PunchOut session</span>
        </div>
      </header>
      <main id="main" className="mx-auto max-w-7xl px-4 py-6 sm:px-8">
        <PageMessages />
        {children}
      </main>
    </div>
  );
}
