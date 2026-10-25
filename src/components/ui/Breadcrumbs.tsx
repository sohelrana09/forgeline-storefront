import Link from "next/link";

export function Breadcrumbs({ items }: { items: { label: string; href?: string }[] }) {
  return (
    <nav aria-label="Breadcrumb" className="text-sm text-gray-600">
      <ol className="m-0 flex list-none flex-wrap items-center gap-1 p-0">
        <li>
          <Link href="/" className="text-gray-700">
            Home
          </Link>
        </li>
        {items.map((item, i) => (
          <li key={i} className="flex items-center gap-1">
            <span aria-hidden="true">›</span>
            {item.href ? (
              <Link href={item.href} className="text-gray-700">
                {item.label}
              </Link>
            ) : (
              <span aria-current="page" className="font-semibold text-gray-900">
                {item.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
