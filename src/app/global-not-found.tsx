import type { Metadata } from "next";
import { RootDocument } from "@/app/_components/RootDocument";

export const metadata: Metadata = { title: "Page not found", robots: { index: false, follow: false } };

// URLs that match no route at all. With several root layouts there is no single one to wrap a 404 in, so this page
// renders its own document (no header or session). Plain links: they leave this document for a root layout.
export default function GlobalNotFound() {
  return (
    <RootDocument>
      <main className="flex min-h-screen items-center justify-center bg-gray-100 px-4 text-gray-800">
        <div className="flex max-w-md flex-col items-start gap-4 rounded-md border border-gray-200 bg-white p-8">
          <div className="text-xl font-bold tracking-wide">
            IRONLINE<span className="text-orange-700"> SUPPLY</span>
          </div>
          <h1 className="m-0 text-2xl font-bold">Page not found</h1>
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- this document has no router to link with */}
          <a href="/" className="rounded bg-orange-700 px-5 py-3 font-semibold text-white no-underline">
            Go to the homepage
          </a>
        </div>
      </main>
    </RootDocument>
  );
}
