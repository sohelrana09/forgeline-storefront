// The header cart's face: icon with the item count, and "My cart" with the total. The minicart
// (features/cart/components/MiniCart.tsx) wraps it in the link that opens its dropdown.
export function MiniCartBadge({ items, total }: { items: number; total?: string }) {
  return (
    <>
      <span className="relative">
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 4h2l2.4 11.2a1 1 0 0 0 1 .8h9.2a1 1 0 0 0 1-.8L20 8H6.2" />
          <circle cx="9.5" cy="19.5" r="1.3" />
          <circle cx="17" cy="19.5" r="1.3" />
        </svg>
        <span className="absolute -right-2 -top-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-orange-600 px-1 text-xs font-bold text-white">
          {items}
        </span>
      </span>
      <span className="hidden text-sm sm:block">
        <span className="block text-xs text-gray-300">My cart</span>
        <span className="font-semibold">{total ?? "Empty"}</span>
      </span>
    </>
  );
}
