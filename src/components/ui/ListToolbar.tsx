import { Pagination } from "@/components/ui/Pagination";
import { PageSizeSelect } from "@/components/ui/PageSizeSelect";

export const PAGE_SIZES = [10, 20, 50];

// commercetools rejects query offsets above 10,000.
const MAX_OFFSET = 10_000;

// Reads ?page / ?limit style params safely: whole numbers, size one of PAGE_SIZES, page from 1 up to the last
// page the API can serve at that size.
export function listParams(page: string | undefined, limit: string | undefined, defaultSize = PAGE_SIZES[0]) {
  const size = PAGE_SIZES.includes(Number(limit)) ? Number(limit) : defaultSize;
  const n = Math.floor(Number(page));
  return { page: Number.isFinite(n) ? Math.min(Math.max(n, 1), Math.floor(MAX_OFFSET / size) + 1) : 1, size };
}

// Magento's list toolbar: "Items 1 to 10 of 23 total", the pager, and "Show N per page". Always shown when the
// list has items, so the count and page size are visible even on a single page.
export function ListToolbar({
  page,
  size,
  total,
  hrefFor,
  label,
}: {
  page: number;
  size: number;
  total: number;
  hrefFor: (page: number, size: number) => string;
  label: string;
}) {
  if (total === 0) return null;
  const pages = Math.max(1, Math.ceil(total / size));
  const first = Math.min((page - 1) * size + 1, total);
  const last = Math.min(page * size, total);
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
      <p className="m-0 text-sm text-gray-700">
        {page > pages ? `Page ${page} is past the end: ${total} total` : `Items ${first} to ${last} of ${total} total`}
      </p>
      <Pagination page={page} pages={pages} hrefFor={(p) => hrefFor(p, size)} label={`${label} pages`} />
      <PageSizeSelect value={size} label={`${label} per page`} options={PAGE_SIZES.map((s) => ({ size: s, href: hrefFor(1, s) }))} />
    </div>
  );
}
