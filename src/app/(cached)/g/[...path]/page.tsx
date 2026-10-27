import type { Metadata } from "next";
import { getGuestContext } from "@/features/business-units/service";
import { getUrlIndex } from "@/features/urls/service";
import { CatalogRoute, catalogMetadata } from "@/features/urls/components/CatalogRoute";

// Cached guest copy of every catalog URL without parameters (category, product master variant, content page).
export const revalidate = 300;
export const dynamic = "error";
// Every path must be listed at build time: Next matches on-demand ISR against the URL before the proxy
// rewrite (/excavators, not /g/excavators), so a path missing here renders per request (uncached) until the next build.
export async function generateStaticParams() {
  const { paths } = await getUrlIndex();
  return [...paths].filter(([, target]) => target.kind !== "redirect").map(([path]) => ({ path: path.split("/").filter(Boolean) }));
}

type Params = { params: Promise<{ path: string[] }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const [{ path }, context] = await Promise.all([params, getGuestContext()]);
  return catalogMetadata(path, {}, context);
}

export default async function CachedCatalogPage({ params }: Params) {
  const [{ path }, context] = await Promise.all([params, getGuestContext()]);
  return <CatalogRoute path={path} query={{}} context={context} />;
}
