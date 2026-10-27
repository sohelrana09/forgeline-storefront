import type { Metadata } from "next";
import { requireBrowseContext } from "@/features/business-units/context";
import type { CategoryQuery } from "@/features/catalog/components/CategoryView";
import { CatalogRoute, catalogMetadata } from "@/features/urls/components/CatalogRoute";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ path: string[] }>; searchParams: Promise<CategoryQuery> };

// Every catalog URL (category paths, products, content pages, old URLs that redirect) for signed-in customers and
// URLs with parameters (filters, ?sku). Guests without parameters get the cached copy in (cached)/g. Metadata
// resolves first, so unknown paths answer a real 404 and redirects are real redirects.
export async function generateMetadata({ params, searchParams }: Params): Promise<Metadata> {
  const [{ path }, query, { context }] = await Promise.all([params, searchParams, requireBrowseContext()]);
  return catalogMetadata(path, query, context);
}

export default async function CatalogPage({ params, searchParams }: Params) {
  const [{ path }, query, { context }] = await Promise.all([params, searchParams, requireBrowseContext()]);
  return <CatalogRoute path={path} query={query} context={context} />;
}
