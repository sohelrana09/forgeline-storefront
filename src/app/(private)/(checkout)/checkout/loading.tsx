// Skeleton while this page loads (the header stays). Catalog pages (home, categories, products, content pages) have
// none on purpose: without a streamed shell they can answer a real 404 status for unknown URLs.
export default function ShopLoading() {
  return (
    <div role="status" aria-label="Loading" className="flex animate-pulse flex-col gap-6">
      <div className="h-8 w-64 rounded bg-gray-200" />
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="flex flex-col gap-3 rounded-md border border-gray-200 bg-white p-4">
            <div className="aspect-square w-full rounded bg-gray-100" />
            <div className="h-4 w-3/4 rounded bg-gray-200" />
            <div className="h-4 w-1/3 rounded bg-gray-200" />
          </div>
        ))}
      </div>
    </div>
  );
}
