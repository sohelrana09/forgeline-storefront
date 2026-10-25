import Link from "next/link";

// Links to the CMS pages (title + slug only, so this stays independent of the CMS backend).
export function SiteFooter({ pages }: { pages: { slug: string; title: string }[] }) {
  if (pages.length === 0) return null;
  return (
    <footer className="mt-10 border-t border-gray-200 bg-white">
      <nav aria-label="Information" className="mx-auto max-w-7xl px-4 py-6 sm:px-8">
        <ul className="m-0 flex list-none flex-wrap gap-x-6 gap-y-2 p-0 text-sm">
          {pages.map((p) => (
            <li key={p.slug}>
              <Link href={`/pages/${p.slug}`} className="text-gray-700">
                {p.title}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </footer>
  );
}
