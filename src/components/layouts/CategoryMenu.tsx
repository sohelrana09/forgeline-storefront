import Link from "next/link";
import { MenuBehavior } from "@/components/layouts/MenuBehavior";

const NAV_ID = "category-menu";

export type MenuItem = { id: string; label: string; href: string; children: MenuItem[] };

// Three-level category menu, no client JavaScript:
// - desktop (md+): horizontal bar of top-level categories; hover or keyboard focus drops down a vertical list,
//   and items with children open a flyout to the side. MenuBehavior flips menus near the right edge leftwards
//   and closes a menu once one of its links is clicked.
// - mobile: a "Categories" disclosure with nested expandable sections (<details>)
export function CategoryMenu({ items }: { items: MenuItem[] }) {
  return (
    <nav id={NAV_ID} aria-label="Categories" className="border-t border-gray-800">
      <MenuBehavior navId={NAV_ID} />
      <DesktopMenu items={items} />
      <MobileMenu items={items} />
    </nav>
  );
}

function DesktopMenu({ items }: { items: MenuItem[] }) {
  return (
    <ul className="mx-auto m-0 hidden max-w-7xl list-none flex-wrap px-4 sm:px-8 md:flex">
      {items.map((item) => {
        return (
          <li key={item.id} data-menu-top="" className="group/top relative">
            <Link
              href={item.href}
              aria-haspopup={item.children.length > 0 ? "true" : undefined}
              className="block whitespace-nowrap px-3 py-3 text-sm font-medium text-gray-200 no-underline hover:bg-gray-800 hover:text-white group-focus-within/top:bg-gray-800 group-focus-within/top:text-white group-hover/top:bg-gray-800 group-hover/top:text-white"
            >
              {item.label}
              {item.children.length > 0 && (
                <span aria-hidden="true" className="ml-1 text-gray-400">
                  ▾
                </span>
              )}
            </Link>
            {item.children.length > 0 && (
              <Dropdown
                items={item.children}
                className="top-full left-0 hidden group-focus-within/top:block group-hover/top:block group-data-[align=right]/top:left-auto group-data-[align=right]/top:right-0 group-data-[closed]/top:hidden!"
              />
            )}
          </li>
        );
      })}
    </ul>
  );
}

function Dropdown({ items, className }: { items: MenuItem[]; className: string }) {
  return (
    <ul className={`absolute z-40 m-0 min-w-60 list-none border border-gray-200 bg-white py-1 text-gray-800 shadow-lg ${className}`}>
      {items.map((child) => (
        <li key={child.id} className="group/sub relative">
          <Link
            href={child.href}
            aria-haspopup={child.children.length > 0 ? "true" : undefined}
            className="flex items-center justify-between gap-4 whitespace-nowrap px-4 py-2.5 text-sm text-gray-800 no-underline hover:bg-gray-100 hover:text-orange-800 group-focus-within/sub:bg-gray-100 group-hover/sub:bg-gray-100"
          >
            {child.label}
            {child.children.length > 0 && (
              <span aria-hidden="true" className="inline-block text-gray-400 group-data-[align=right]/top:rotate-180">
                ▸
              </span>
            )}
          </Link>
          {child.children.length > 0 && (
            // Flyout: level 3, beside the level-2 item.
            <ul
              data-menu-flyout=""
              className="absolute top-0 left-full z-50 m-0 hidden min-w-60 list-none border border-gray-200 bg-white py-1 shadow-lg group-focus-within/sub:block group-hover/sub:block group-data-[align=right]/top:left-auto group-data-[align=right]/top:right-full group-data-[closed]/top:hidden!"
            >
              {child.children.map((grandchild) => (
                <li key={grandchild.id}>
                  <Link
                    href={grandchild.href}
                    className="block whitespace-nowrap px-4 py-2.5 text-sm text-gray-800 no-underline hover:bg-gray-100 hover:text-orange-800 focus:bg-gray-100"
                  >
                    {grandchild.label}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </li>
      ))}
    </ul>
  );
}

function MobileMenu({ items }: { items: MenuItem[] }) {
  return (
    <details className="group/mobile md:hidden">
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between px-4 text-sm font-semibold text-gray-100">
        Categories
        <span aria-hidden="true" className="transition-transform group-open/mobile:rotate-180">
          ▾
        </span>
      </summary>
      <div className="border-t border-gray-800 bg-white px-4 py-2 text-gray-800">
        <MobileLevel items={items} depth={0} />
      </div>
    </details>
  );
}

function MobileLevel({ items, depth }: { items: MenuItem[]; depth: number }) {
  return (
    <ul className={`m-0 list-none p-0 ${depth > 0 ? "border-l border-gray-200 pl-3" : ""}`}>
      {items.map((item) =>
        item.children.length === 0 ? (
          <li key={item.id}>
            <Link href={item.href} className="block py-2.5 text-gray-800 no-underline">
              {item.label}
            </Link>
          </li>
        ) : (
          <li key={item.id}>
            <details className="group/item">
              <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between py-2 font-medium">
                {item.label}
                <span aria-hidden="true" className="text-gray-500 transition-transform group-open/item:rotate-45">
                  +
                </span>
              </summary>
              <Link href={item.href} className="block py-2 pl-3 text-sm font-semibold text-orange-800">
                All {item.label}
              </Link>
              <div className="pl-3">
                <MobileLevel items={item.children} depth={depth + 1} />
              </div>
            </details>
          </li>
        ),
      )}
    </ul>
  );
}
