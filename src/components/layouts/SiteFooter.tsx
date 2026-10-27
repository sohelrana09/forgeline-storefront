import Link from "next/link";

// Footer links (the blog and the CMS pages; built by the layouts, so this stays independent of the CMS backend).
export function SiteFooter({ links }: { links: { href: string; label: string }[] }) {
  if (links.length === 0) return null;
  return (
    <footer className="mt-10 border-t border-gray-200 bg-white">
      <nav aria-label="Information" className="mx-auto max-w-7xl px-4 py-6 sm:px-8">
        <ul className="m-0 flex list-none flex-wrap gap-x-6 gap-y-2 p-0 text-sm">
          {links.map((l) => (
            <li key={l.href}>
              <Link href={l.href} className="text-gray-700">
                {l.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </footer>
  );
}
