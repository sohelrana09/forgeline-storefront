import { notFound } from "next/navigation";
import { getPage } from "@/features/cms/service";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { Markdown } from "@/components/ui/Markdown";
import { RichText } from "@/features/cms/components/RichText";
import type { BuyerContext } from "@/features/business-units/types";

// Magento-style CMS page: Sanity rich text, or Markdown from the "cms-page" Custom Objects (features/cms/service.ts).
export async function CmsPageView({ slug, context }: { slug: string; context: BuyerContext }) {
  const page = await getPage(slug).catch((err) => {
    console.error("CMS page failed", err?.body ?? err);
    return undefined;
  });
  if (!page) notFound();
  return (
    <div className="flex flex-col gap-4">
      <Breadcrumbs items={[{ label: page.title }]} />
      <article className="max-w-3xl rounded-md border border-gray-200 bg-white p-6">
        <h1 className="mb-4 mt-0 text-3xl font-bold">{page.title}</h1>
        {page.body ? <RichText value={page.body} context={context} /> : <Markdown>{page.content ?? ""}</Markdown>}
      </article>
    </div>
  );
}
