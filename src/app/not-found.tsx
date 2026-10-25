import Link from "next/link";

// URLs that match no route at all (outside the shop layout, so no header or session is needed).
export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-100 px-4 text-gray-800">
      <div className="flex max-w-md flex-col items-start gap-4 rounded-md border border-gray-200 bg-white p-8">
        <div className="text-xl font-bold tracking-wide">
          IRONLINE<span className="text-orange-700"> SUPPLY</span>
        </div>
        <h1 className="m-0 text-2xl font-bold">Page not found</h1>
        <Link href="/" className="rounded bg-orange-700 px-5 py-3 font-semibold text-white no-underline">
          Go to the homepage
        </Link>
      </div>
    </main>
  );
}
