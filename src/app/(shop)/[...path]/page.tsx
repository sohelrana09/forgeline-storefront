import { Suspense } from "react";
import type { Metadata } from "next";
import { requireBrowseContext } from "@/features/business-units/context";
import { getGuestContext } from "@/features/business-units/service";
import type { CategoryQuery } from "@/features/catalog/components/CategoryView";
import { CatalogContent, catalogMetadata, resolveTarget, type CatalogTarget } from "@/features/urls/components/CatalogRoute";
import { getUrlIndex } from "@/features/urls/service";
import { PageSkeleton } from "@/components/ui/PageSkeleton";

type Params = { params: Promise<{ path: string[] }>; searchParams: Promise<CategoryQuery> };

// Redirects (which keep the URL's query) and the Studio's draft preview of unpublished pages read request data
// before anything streams; every other path has a prerendered shell.
export const instant = false;

// Every catalog URL is prerendered at build time (shell and cached reads); URLs added later get theirs on the first
// visit.
export async function generateStaticParams() {
  const { paths } = await getUrlIndex();
  return [...paths].filter(([, target]) => target.kind !== "redirect").map(([path]) => ({ path: path.split("/").filter(Boolean) }));
}

export async function generateMetadata({ params, searchParams }: Params): Promise<Metadata> {
  const [{ path }, query, guest] = await Promise.all([params, searchParams, getGuestContext()]);
  return catalogMetadata(path, query, guest);
}

// Every catalog URL (category paths, products, content pages, old URLs that redirect). The path resolves before the
// first <Suspense>, so unknown paths answer a real 404 and redirects are real redirects; the content is priced for the
// visitor and streams in.
export default async function CatalogPage({ params, searchParams }: Params) {
  const { path } = await params;
  const target = await resolveTarget(path, () => searchParams);
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Content target={target} searchParams={searchParams} />
    </Suspense>
  );
}

async function Content({ target, searchParams }: { target: CatalogTarget; searchParams: Promise<CategoryQuery> }) {
  const [query, { context }] = await Promise.all([searchParams, requireBrowseContext()]);
  return <CatalogContent target={target} query={query} context={context} />;
}
