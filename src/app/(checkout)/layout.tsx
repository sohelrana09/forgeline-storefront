import type { Metadata } from "next";
import Link from "next/link";
import { SiteLogo } from "@/components/layouts/SiteLogo";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { robots: { index: false, follow: false } };

// Magento-style checkout: only the logo and a way back to the cart; no search, category menu, mini-cart or footer,
// so nothing pulls the buyer away while they order.
export default function CheckoutLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-100 text-gray-800">
      <header className="bg-gray-900 text-gray-50">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-8">
          <SiteLogo />
          <div className="flex items-center gap-5 text-sm">
            <span className="flex items-center gap-2 text-gray-300">
              <svg aria-hidden="true" viewBox="0 0 20 20" className="size-4 fill-current">
                <path d="M10 1a5 5 0 0 0-5 5v3H4a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1V6a5 5 0 0 0-5-5Zm-3 8V6a3 3 0 1 1 6 0v3H7Z" />
              </svg>
              Secure checkout
            </span>
            <Link href="/cart" className="text-gray-200 hover:text-white">
              Back to cart
            </Link>
          </div>
        </div>
      </header>
      <main id="main" className="mx-auto max-w-7xl px-4 py-6 sm:px-8">
        {children}
      </main>
    </div>
  );
}
