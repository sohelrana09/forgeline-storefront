import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { firstParam } from "@/lib/utils";
import { requireBrowseContext } from "@/features/business-units/context";
import { SearchResultsView } from "@/features/catalog/components/SearchResultsView";
import { listParams } from "@/components/ui/ListToolbar";

type Search = { q?: string | string[]; page?: string; limit?: string };

export async function generateMetadata({ searchParams }: { searchParams: Promise<Search> }): Promise<Metadata> {
  const { q } = await searchParams;
  return {
    title: `Search results for "${(firstParam(q) ?? "").slice(0, 100)}"`,
    robots: { index: false, follow: true },
  };
}

export default async function SearchPage({ searchParams }: { searchParams: Promise<Search> }) {
  const [{ q, page, limit }, { context }] = await Promise.all([searchParams, requireBrowseContext()]);
  const query = (firstParam(q) ?? "").trim().slice(0, 100);
  if (!query) redirect("/");
  return <SearchResultsView context={context} query={query} {...listParams(page, limit, 20)} />;
}
