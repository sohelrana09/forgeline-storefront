import Link from "next/link";

// Numbered page links (state lives in the URL, so pages are shareable and Back works):
// ‹ Previous  1 … 4 5 6 … 12  Next ›
export function Pagination({
  page,
  pages,
  hrefFor,
  label = "Pages",
}: {
  page: number;
  pages: number;
  hrefFor: (page: number) => string;
  label?: string;
}) {
  if (pages <= 1) return null;

  // First, last, and the current page with one neighbour on each side; gaps become "…".
  const shown = [...new Set([1, page - 1, page, page + 1, pages])].filter((p) => p >= 1 && p <= pages).sort((a, b) => a - b);
  const items: (number | "gap")[] = [];
  shown.forEach((p, i) => {
    if (i > 0 && p - shown[i - 1] > 1) items.push("gap");
    items.push(p);
  });

  const box = "flex min-h-11 min-w-11 items-center justify-center rounded px-3 text-sm no-underline";
  return (
    <nav aria-label={label} className="flex flex-wrap items-center justify-center gap-1">
      {page > 1 ? (
        <Link href={hrefFor(page - 1)} className={`${box} text-gray-800 hover:bg-gray-100`} rel="prev">
          ‹ Previous
        </Link>
      ) : (
        <span className={`${box} text-gray-400`} aria-hidden="true">
          ‹ Previous
        </span>
      )}
      {items.map((item, i) =>
        item === "gap" ? (
          <span key={`gap-${i}`} className={`${box} text-gray-500`} aria-hidden="true">
            …
          </span>
        ) : item === page ? (
          <span key={item} aria-current="page" className={`${box} bg-gray-900 font-semibold text-white`}>
            {item}
          </span>
        ) : (
          <Link key={item} href={hrefFor(item)} aria-label={`Page ${item}`} className={`${box} text-gray-800 hover:bg-gray-100`}>
            {item}
          </Link>
        ),
      )}
      {page < pages ? (
        <Link href={hrefFor(page + 1)} className={`${box} text-gray-800 hover:bg-gray-100`} rel="next">
          Next ›
        </Link>
      ) : (
        <span className={`${box} text-gray-400`} aria-hidden="true">
          Next ›
        </span>
      )}
    </nav>
  );
}
