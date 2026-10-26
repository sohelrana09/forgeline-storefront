import Link from "next/link";
import { searchProducts } from "@/features/catalog/service";
import { taxNote } from "@/features/catalog/utils";
import { ProductCard } from "@/features/catalog/components/ProductCard";
import { ListToolbar } from "@/components/ui/ListToolbar";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import type { BuyerContext } from "@/features/business-units/types";

export async function SearchResultsView({
  context,
  query,
  page,
  size,
}: {
  context: BuyerContext;
  query: string;
  page: number;
  size: number;
}) {
  const { products, total, corrected } = await searchProducts(context, query, page, size);
  const hrefFor = (p: number, s: number) =>
    `/search?${new URLSearchParams({ q: query, ...(p > 1 && { page: String(p) }), ...(s !== 20 && { limit: String(s) }) })}`;

  return (
    <div className="flex flex-col gap-6">
      <Breadcrumbs items={[{ label: `Search results for "${query}"` }]} />
      <h1 className="m-0 text-2xl font-bold">Search results for: &lsquo;{query}&rsquo;</h1>
      {corrected && total > 0 && (
        <p className="m-0 -mt-3 text-sm text-gray-700">
          No exact matches. Showing results for <strong>&lsquo;{corrected}&rsquo;</strong>.
        </p>
      )}
      {total === 0 ? (
        <div className="flex flex-col items-start gap-3 rounded-md border border-gray-200 bg-white p-6">
          <p className="m-0">Your search returned no results. Try a product name, a model code such as S567 UV, or a SKU.</p>
          <Link href="/quick-order" className="text-sm text-orange-800">
            Browse the full catalog in Quick order
          </Link>
        </div>
      ) : (
        <>
          <div className="rounded-md border border-gray-200 bg-white">
            <ListToolbar page={page} size={size} total={total} label="Search results" hrefFor={hrefFor} />
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {products.map((p) => (
              <ProductCard
                key={p.id}
                product={p}
                canOrder={context.canOrder}
                canQuote={!context.consumer}
                note={taxNote(context.country)}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
