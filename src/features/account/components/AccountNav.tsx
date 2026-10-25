"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const GROUPS = [
  {
    title: undefined,
    links: [
      { href: "/account", label: "My account" },
      { href: "/account/orders", label: "My orders" },
      { href: "/account/quotes", label: "My quotes" },
      { href: "/account/purchase-lists", label: "Purchase lists" },
      { href: "/account/addresses", label: "Address book" },
      { href: "/account/information", label: "Account information" },
    ],
  },
  {
    title: "Company",
    links: [
      { href: "/account/company", label: "Company profile" },
      { href: "/account/company/users", label: "Company users" },
      { href: "/account/company/roles", label: "Roles and permissions" },
      { href: "/account/company/structure", label: "Company structure" },
      { href: "/account/approvals", label: "Order approvals" },
      { href: "/account/company/approval-rules", label: "Approval rules" },
    ],
  },
];
const BUSINESS_ONLY = new Set([
  "/account/quotes",
  "/account/company",
  "/account/company/users",
  "/account/company/roles",
  "/account/company/structure",
  "/account/approvals",
  "/account/company/approval-rules",
]);

// Magento's account sidebar. The current section stays highlighted on its detail pages too (an order, a quote).
// `business`: a company buyer (quotes and the Company group); consumers see their personal sections only.
// `approver` / `ruleManager`: the approval links, for associates whose roles allow them (pages re-check live).
export function AccountNav({ business, approver = false, ruleManager = false }: { business: boolean; approver?: boolean; ruleManager?: boolean }) {
  const pathname = usePathname();
  const allowed = (href: string) =>
    (business || !BUSINESS_ONLY.has(href)) &&
    (href !== "/account/approvals" || approver) &&
    (href !== "/account/company/approval-rules" || ruleManager);
  const groups = GROUPS.map((g) => ({ ...g, links: g.links.filter((l) => allowed(l.href)) })).filter(
    (g) => g.links.length > 0,
  );
  const ALL = groups.flatMap((g) => g.links.map((l) => l.href));
  // The longest matching link wins, so /account/company/users highlights "Company users", not "Company profile".
  const current = ALL.filter((h) => pathname === h || (h !== "/account" && pathname.startsWith(`${h}/`))).sort(
    (a, b) => b.length - a.length,
  )[0];
  const active = (href: string) => href === current;
  return (
    <nav aria-label="My account" className="flex gap-1 overflow-x-auto md:flex-col md:gap-3">
      {groups.map((group) => (
        <div key={group.title ?? "account"} className="flex md:flex-col">
          {group.title && (
            <h2 className="m-0 hidden px-4 pb-1 text-xs font-semibold uppercase tracking-wide text-gray-500 md:block">{group.title}</h2>
          )}
          <ul className="m-0 flex list-none gap-1 p-0 md:flex-col">
            {group.links.map(({ href, label }) => (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={active(href) ? "page" : undefined}
                  className={`flex min-h-11 items-center whitespace-nowrap border-orange-700 px-4 text-sm no-underline md:border-l-4 ${
                    active(href)
                      ? "bg-orange-50 font-semibold text-gray-900 md:border-l-orange-700"
                      : "text-gray-700 hover:bg-gray-50 md:border-l-transparent"
                  }`}
                >
                  {label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}
