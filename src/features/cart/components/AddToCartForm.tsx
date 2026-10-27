"use client";

import { addSku } from "@/features/cart/actions";
import { QuantityInput } from "@/components/ui/QuantityInput";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { CART_CHANGED } from "@/features/cart/minicart";
import { checkMessages } from "@/components/ui/PageMessages";

// Quantity + Add. Machines above the quote threshold go into the same cart "for quote": the cart then offers a
// quote request instead of checkout.
export function AddToCartForm({
  sku,
  name,
  canOrder,
  canQuote = true,
  quoteOnly,
  size = "md",
}: {
  sku: string;
  name: string;
  canOrder: boolean;
  // Consumers can't request quotes, so machines (quote only) aren't for them.
  canQuote?: boolean;
  quoteOnly: boolean;
  // md: product cards (stacked) · lg: product page · row: table rows (one compact line)
  size?: "md" | "lg" | "row";
}) {
  if (!canOrder) return <p className="m-0 text-xs text-gray-500">Only buyers can order.</p>;
  if (quoteOnly && !canQuote) return <p className="m-0 text-xs text-gray-600">Sold to business customers on quote.</p>;
  return (
    // Cards (md) are narrow: stack the selector over a full-width button. The PDP (lg) and tables put them side by side.
    // After adding, tell the mini-cart: on cached guest pages it's loaded in the browser and refreshes on this event.
    // (The action posts to the public URL, which isn't rewritten, so its response re-renders the per-visitor page.)
    <form
      action={async (formData) => {
        await addSku(formData);
        window.dispatchEvent(new Event(CART_CHANGED));
        checkMessages(); // "You added … to your shopping cart." at the top of the page
      }}
      className={size === "md" ? "flex w-full flex-col gap-2" : "flex items-center gap-3"}
    >
      <input type="hidden" name="sku" value={sku} />
      <QuantityInput
        name="quantity"
        label={`quantity for ${name}`}
        className={size === "lg" ? "w-36" : size === "row" ? "w-32" : "w-full"}
      />
      <SubmitButton
        className={`min-h-11 rounded px-4 text-sm font-semibold disabled:opacity-60 ${
          quoteOnly
            ? "border border-orange-700 bg-white text-orange-800 hover:bg-orange-50"
            : "bg-orange-700 text-white hover:bg-orange-800"
        } ${size === "lg" ? "flex-1 text-base" : size === "row" ? "whitespace-nowrap" : "w-full"}`}
      >
        {quoteOnly ? "Add for quote" : "Add to cart"}
      </SubmitButton>
    </form>
  );
}
