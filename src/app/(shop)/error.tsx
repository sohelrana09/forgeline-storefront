"use client";

import { useEffect } from "react";
import Link from "next/link";

// Error boundary for shop pages: the header stays usable, and the buyer can retry without a full reload.
// Server errors reach the browser without their message (only `digest`), so nothing internal leaks here.
export default function ShopError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div role="alert" className="flex flex-col items-start gap-4 rounded-md border border-red-200 bg-white p-8">
      <h1 className="m-0 text-2xl font-bold">Something went wrong</h1>
      <p className="m-0 text-gray-700">
        This page couldn&apos;t be loaded. Please try again.
        {error.digest && <span className="block text-xs text-gray-500">Reference: {error.digest}</span>}
      </p>
      <div className="flex gap-3">
        <button onClick={reset} className="min-h-11 rounded bg-orange-700 px-5 font-semibold text-white">
          Try again
        </button>
        <Link href="/" className="rounded border border-gray-300 px-5 py-3 font-semibold text-gray-800 no-underline">
          Go to the homepage
        </Link>
      </div>
    </div>
  );
}
