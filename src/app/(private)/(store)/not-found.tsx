import Link from "next/link";

// Shown inside the shop layout when a page calls notFound() (unknown category, product, order or CMS page).
export default function ShopNotFound() {
  return (
    <div className="flex flex-col items-start gap-4 rounded-md border border-gray-200 bg-white p-8">
      <h1 className="m-0 text-2xl font-bold">We couldn&apos;t find that page</h1>
      <p className="m-0 text-gray-700">The product, category or page may have been moved or is no longer available.</p>
      <div className="flex gap-3">
        <Link href="/" className="rounded bg-orange-700 px-5 py-3 font-semibold text-white no-underline">
          Go to the homepage
        </Link>
        <Link href="/quick-order" className="rounded border border-gray-300 px-5 py-3 font-semibold text-gray-800 no-underline">
          Order by SKU
        </Link>
      </div>
    </div>
  );
}
