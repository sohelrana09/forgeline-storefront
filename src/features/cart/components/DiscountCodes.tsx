import type { Cart } from "@commercetools/platform-sdk";
import { applyDiscountCodeAction, removeDiscountCodeAction } from "@/features/cart/actions";
import { discountStateLabel } from "@/features/cart/discount";
import { SubmitButton } from "@/components/ui/SubmitButton";

// Discount code entry on the cart page (G7): plain forms, so it works without JavaScript; results show in the page
// message bar. commercetools only returns a reference to an applied code (not its text), so codes in the cart are
// listed by their status; the message after applying names the code.
// `locked`: a payment is open for the cart (features/cart/payment-lock.ts), so codes can't change.
export function DiscountCodes({ cart, locked }: { cart: Cart; locked: boolean }) {
  return (
    <section aria-label="Discount code" className="flex flex-col gap-3 rounded-md border border-gray-200 bg-white p-5 text-sm">
      <h2 className="m-0 text-base font-semibold">Discount code</h2>
      {cart.discountCodes.length > 0 && (
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {cart.discountCodes.map((d, i) => (
            <li key={d.discountCode.id} className="flex items-center justify-between gap-3">
              <span>
                {cart.discountCodes.length > 1 ? `Code ${i + 1}` : "Code"} ·{" "}
                <span className="text-gray-600">{discountStateLabel(d.state)}</span>
              </span>
              {!locked && (
                <form action={removeDiscountCodeAction}>
                  <input type="hidden" name="discountCodeId" value={d.discountCode.id} />
                  <SubmitButton className="text-sm font-semibold text-[#1979c3] hover:underline">Remove</SubmitButton>
                </form>
              )}
            </li>
          ))}
        </ul>
      )}
      {!locked && (
        <form action={applyDiscountCodeAction} className="flex gap-2">
          <label htmlFor="discount-code" className="sr-only">
            Discount code
          </label>
          <input
            id="discount-code"
            name="code"
            required
            maxLength={64}
            autoComplete="off"
            placeholder="Enter discount code"
            className="min-h-11 min-w-0 flex-1 rounded border border-gray-300 px-3"
          />
          <SubmitButton className="min-h-11 rounded border border-gray-300 bg-white px-4 font-semibold hover:bg-gray-50">
            Apply
          </SubmitButton>
        </form>
      )}
    </section>
  );
}
