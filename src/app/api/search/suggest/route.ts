import { NextResponse, type NextRequest } from "next/server";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { currentBrowseContext } from "@/features/business-units/context";
import { getCategoryTree, suggestProducts } from "@/features/catalog/service";
import { categoryHref, localize } from "@/features/catalog/utils";
import { productPath } from "@/lib/urls";
import { clientIp, tooManyAttempts } from "@/lib/rate-limit";
import { formatMoney } from "@/lib/utils";
import type { Suggestions } from "@/components/layouts/SearchBox";

// Header search autocomplete: the visitor's store decides assortment and prices, so the answer is per visitor.
// Served from the in-memory search index (no commercetools call per keystroke once the index is warm).
export async function GET(request: NextRequest) {
  const q = (request.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 100);
  const empty: Suggestions = { products: [], categories: [], total: 0 };
  if (q.length < 2) return json(empty);
  if (await tooManyAttempts(`suggest:${await clientIp()}`, 3000)) return json(empty, 429);
  try {
    const { context } = await currentBrowseContext();
    const [r, tree] = await Promise.all([suggestProducts(context, q), getCategoryTree()]);
    return json({
      products: r.products.map((p) => ({
        label: p.name,
        detail: p.sku,
        href: productPath(p.slug),
        image: p.image,
        price: p.fromPrice ? `From ${formatMoney(p.fromPrice)}` : p.price && formatMoney(p.price),
      })),
      categories: r.categories.map((c) => ({ label: localize(c.name), href: categoryHref([...tree.ancestors(c), c]) })),
      total: r.total,
      corrected: r.corrected,
    });
  } catch (err) {
    if (!isRedirectError(err)) console.error("search suggestions failed", (err as { body?: unknown })?.body ?? err);
    return json(empty);
  }
}

const json = (body: Suggestions, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store" } });
