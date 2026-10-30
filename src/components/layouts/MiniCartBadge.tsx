import Link from "next/link";

// The header cart's face: icon with the item count, and "My cart" with the total. The minicart
// (features/cart/components/MiniCart.tsx) wraps it in the link that opens its dropdown. Without `items` (the visitor's
// cart is still streaming in) it shows neither count nor total, so a full cart never flashes as empty.
export function MiniCartBadge({ items, total }: { items?: number; total?: string }) {
  return (
    <>
      <span className="relative">
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 4h2l2.4 11.2a1 1 0 0 0 1 .8h9.2a1 1 0 0 0 1-.8L20 8H6.2" />
          <circle cx="9.5" cy="19.5" r="1.3" />
          <circle cx="17" cy="19.5" r="1.3" />
        </svg>
        {items !== undefined && (
          <span className="absolute -right-2 -top-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-orange-600 px-1 text-xs font-bold text-white">
            {items}
          </span>
        )}
      </span>
      <span className="hidden text-sm sm:block">
        <span className="block text-xs text-gray-300">My cart</span>
        <span className="font-semibold">{items === undefined ? "\u00a0" : (total ?? "Empty")}</span>
      </span>
    </>
  );
}

// The header cart on a prerendered page until the visitor's cart streams in: a plain link to the cart page.
export function MiniCartPlaceholder() {
  return (
    <div className="relative ml-auto sm:ml-0">
      <Link href="/cart" aria-label="Cart" className="flex items-center gap-3 text-gray-50 no-underline hover:text-white">
        <MiniCartBadge />
      </Link>
    </div>
  );
}
