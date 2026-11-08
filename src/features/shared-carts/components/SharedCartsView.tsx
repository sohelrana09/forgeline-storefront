import { dateLocale } from "@/lib/i18n";
import { redirect } from "next/navigation";
import { SharedCartError, cartsSharedWithMe } from "@/features/shared-carts/service";
import { ReviewButtons } from "@/features/shared-carts/components/ShareForms";
import type { Session } from "@/features/auth/session";
import type { BuyerContext } from "@/features/business-units/types";

const when = (iso?: string) =>
  iso ? new Date(iso).toLocaleDateString(dateLocale(), { day: "2-digit", month: "short", year: "numeric" }) : "";

// /account/shared-carts: carts colleagues sent the signed-in reviewer in the selected unit.
export async function SharedCartsView({ session, context }: { session: Session; context: BuyerContext }) {
  const carts = await cartsSharedWithMe(session, context).catch((err) => {
    if (err instanceof SharedCartError) redirect("/account");
    throw err;
  });
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="m-0 text-2xl font-bold">Carts shared with me</h1>
        <p className="m-0 mt-1 text-sm text-gray-600">
          Colleagues at {context.businessUnitName} sent you these carts to review. Take one over to change it and place the order.
        </p>
      </div>
      {carts.length === 0 ? (
        <p className="m-0 rounded-md border border-gray-200 bg-white p-6 text-sm">No carts are waiting for you.</p>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-4 p-0">
          {carts.map((c) => (
            <li key={c.id}>
              <section
                aria-label={`Cart from ${c.from}`}
                className="flex flex-col gap-3 rounded-md border border-gray-200 bg-white p-5 text-sm"
              >
                <h2 className="m-0 text-base font-semibold">
                  From {c.from}
                  {c.sharedAt && <span className="font-normal text-gray-600"> · {when(c.sharedAt)}</span>}
                </h2>
                {c.note && <p className="m-0 whitespace-pre-line rounded bg-gray-50 p-2">Note: {c.note}</p>}
                <table className="w-full border-collapse">
                  <caption className="sr-only">Lines of the cart from {c.from}</caption>
                  <thead>
                    <tr className="text-left text-xs uppercase tracking-wide text-gray-600">
                      <th scope="col">Product</th>
                      <th scope="col">SKU</th>
                      <th scope="col" className="text-right">
                        Qty
                      </th>
                      <th scope="col" className="text-right">
                        Total
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {c.lines.map((l) => (
                      <tr key={l.sku} className="border-t border-gray-200">
                        <td className="py-1">{l.name}</td>
                        <td className="py-1 text-gray-600">{l.sku}</td>
                        <td className="py-1 text-right">{l.quantity}</td>
                        <td className="py-1 text-right">{l.total}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="m-0 text-right font-semibold">Total {c.total}</p>
                <ReviewButtons cartId={c.id} from={c.from} />
              </section>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
