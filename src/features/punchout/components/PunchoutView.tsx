import { Message } from "@/components/ui/Message";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { formatMoney } from "@/lib/utils";
import { addPunchoutLinesAction, setPunchoutLineAction } from "@/features/punchout/actions";
import { PunchoutError, getPunchout, punchoutCart, summarizeCart } from "@/features/punchout/service";

// The PunchOut cart: add by SKU, change quantities, return to the procurement system. Plain forms, no client code.
export async function PunchoutView() {
  const session = await getPunchout();
  if (!session) {
    return (
      <Message type="warning">
        Your PunchOut session has ended or hasn&apos;t started. Please start again from your procurement system.
      </Message>
    );
  }
  let data;
  try {
    data = await punchoutCart(session);
  } catch (err) {
    if (err instanceof PunchoutError) return <Message type="warning">{err.message}</Message>;
    throw err;
  }
  const { cart, ctx } = data;
  const lines = summarizeCart(cart);
  const returnHost = new URL(session.returnUrl).hostname;
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
      <section className="flex flex-col gap-4 rounded bg-white p-6">
        <h1 className="text-2xl font-semibold">Your PunchOut cart</h1>
        <p className="text-sm text-gray-600">
          Ordering for {ctx.businessUnitName} at your company prices. When you&apos;re done, return the cart to {returnHost} and complete
          the requisition there.
        </p>
        {lines.length === 0 ? (
          <p className="text-gray-600">Your cart is empty. Add products by SKU.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b text-left text-gray-500">
              <tr>
                <th className="py-2">Product</th>
                <th className="py-2">Unit price</th>
                <th className="py-2">Quantity</th>
                <th className="py-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l) => (
                <tr key={l.id} className="border-b last:border-0">
                  <td className="py-2">
                    {l.name}
                    <div className="text-xs text-gray-500">SKU {l.sku}</div>
                  </td>
                  <td className="py-2">{formatMoney(l.unit)}</td>
                  <td className="py-2">
                    <form action={setPunchoutLineAction} className="flex items-center gap-2">
                      <input type="hidden" name="lineId" value={l.id} />
                      <label className="sr-only" htmlFor={`qty-${l.id}`}>
                        Quantity of {l.sku}
                      </label>
                      <input
                        id={`qty-${l.id}`}
                        name="quantity"
                        type="number"
                        min={0}
                        max={9999}
                        defaultValue={l.quantity}
                        className="w-20 rounded border px-2 py-1"
                      />
                      <SubmitButton className="text-blue-700 underline">Update</SubmitButton>
                    </form>
                  </td>
                  <td className="py-2 text-right">{formatMoney(l.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <form action={addPunchoutLinesAction} className="flex flex-col gap-2">
          <label htmlFor="punchout-lines" className="font-medium">
            Add by SKU
          </label>
          <textarea
            id="punchout-lines"
            name="lines"
            rows={3}
            placeholder={"air-filter, 2\noil-filter 4"}
            className="rounded border px-3 py-2 font-mono text-sm"
          />
          <SubmitButton className="self-start rounded bg-gray-900 px-4 py-2 text-white">Add to cart</SubmitButton>
        </form>
      </section>
      <aside className="flex h-fit flex-col gap-3 rounded bg-white p-6">
        <div className="flex justify-between font-semibold">
          <span>Subtotal</span>
          <span>{formatMoney(cart.totalPrice)}</span>
        </div>
        <form method="post" action="/api/punchout/return">
          <button
            type="submit"
            disabled={lines.length === 0}
            className="w-full rounded bg-blue-700 px-4 py-3 font-semibold text-white disabled:opacity-50"
          >
            Return cart to {returnHost}
          </button>
        </form>
        <p className="text-xs text-gray-500">Returning ends this session. Your procurement system creates the order after approval.</p>
      </aside>
    </div>
  );
}
