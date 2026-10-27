import Link from "next/link";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { ListToolbar } from "@/components/ui/ListToolbar";
import { lookupSkus } from "@/features/cart/service";
import { getList, pageLists } from "@/features/purchase-lists/service";
import {
  CreateListForm,
  DeleteListButton,
  ListEditor,
  RenameListForm,
  type EditorLine,
} from "@/features/purchase-lists/components/ListForms";
import type { Session } from "@/features/auth/session";
import type { BuyerContext } from "@/features/business-units/types";
import { Message } from "@/components/ui/Message";

const date = (iso: string) => new Date(iso).toLocaleDateString("en-GB");

// The customer's purchase lists in the selected unit's store, newest change first.
export async function PurchaseListsView({
  session,
  context,
  page,
  size,
  deleted,
}: {
  session: Session;
  context: BuyerContext;
  page: number;
  size: number;
  deleted: boolean;
}) {
  const { lists, total } = await pageLists(session, context, page, size);
  const hrefFor = (p: number, s: number) =>
    `/account/purchase-lists?${new URLSearchParams({ ...(p > 1 && { page: String(p) }), ...(s !== 10 && { limit: String(s) }) })}`;
  return (
    <div className="flex flex-col gap-4">
      <Breadcrumbs items={[{ label: "My account", href: "/account" }, { label: "Purchase lists" }]} />
      <div>
        <h1 className="m-0 text-2xl font-bold">Purchase lists</h1>
        <p className="m-0 mt-1 text-sm text-gray-600">
          Lists of products you order again and again. Add a whole list to your cart in one click
          {context.consumer ? "." : `, at ${context.businessUnitName}'s prices.`}
        </p>
      </div>
      {deleted && <Message type="success">The list was deleted.</Message>}
      <section aria-label="Create a list" className="rounded-md border border-gray-200 bg-white p-5">
        <CreateListForm />
      </section>
      <section aria-label="Purchase lists" className="rounded-md border border-gray-200 bg-white">
        {total === 0 ? (
          <p className="m-0 p-5 text-sm text-gray-600">
            No purchase lists yet. Create one above, or use &ldquo;Add to purchase list&rdquo; on a product, in your cart or in Quick order.
          </p>
        ) : (
          <>
            <div className="relative overflow-x-auto">
              <table className="w-full min-w-[560px] border-collapse text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase tracking-wide text-gray-600">
                    <th className="px-5 py-2.5 font-semibold">Name</th>
                    <th className="px-3 py-2.5 text-right font-semibold">Products</th>
                    <th className="px-3 py-2.5 text-right font-semibold">Items</th>
                    <th className="px-3 py-2.5 font-semibold">Last updated</th>
                    <th className="px-5 py-2.5 font-semibold">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {lists.map((l) => (
                    <tr key={l.id} className="border-t border-gray-100">
                      <td className="px-5 py-3 font-semibold">{l.name}</td>
                      <td className="px-3 py-3 text-right">{l.lines}</td>
                      <td className="px-3 py-3 text-right">{l.items}</td>
                      <td className="px-3 py-3">{date(l.lastModifiedAt)}</td>
                      <td className="px-5 py-3 text-right">
                        <Link href={`/account/purchase-lists/${l.id}`} className="text-orange-800" aria-label={`View ${l.name}`}>
                          View
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="border-t border-gray-200">
              <ListToolbar page={page} size={size} total={total} label="Purchase lists" hrefFor={hrefFor} />
            </div>
          </>
        )}
      </section>
    </div>
  );
}

// One list: its lines priced for the selected unit, with what can't be ordered here and why.
export async function PurchaseListView({ session, context, id }: { session: Session; context: BuyerContext; id: string }) {
  const list = await getList(session, context, id);
  if (!list) notFound();
  const skus = await lookupSkus(
    context,
    list.lines.flatMap((l) => (l.sku ? [l.sku] : [])),
  );
  const lines: EditorLine[] = list.lines.map((l) => {
    const info = l.sku ? skus.get(l.sku) : undefined;
    const note = !info
      ? `Not sold to ${context.consumer ? "you" : context.businessUnitName}`
      : !info.priced
        ? `No ${context.currency} price for ${context.consumer ? "you" : context.businessUnitName}`
        : context.consumer && info.quoteOnly
          ? "Sold to business customers on quote"
          : undefined;
    return {
      id: l.id,
      sku: l.sku,
      name: info?.name ?? l.name,
      quantity: l.quantity,
      available: l.available,
      slug: info?.slug,
      image: info?.image,
      price: info?.price && {
        centAmount: info.price.centAmount,
        currencyCode: info.price.currencyCode,
        fractionDigits: info.price.fractionDigits,
      },
      note,
      quoteOnly: Boolean(info?.quoteOnly),
    };
  });
  const items = list.lines.reduce((n, l) => n + l.quantity, 0);

  return (
    <div className="flex flex-col gap-4">
      <Breadcrumbs
        items={[
          { label: "My account", href: "/account" },
          { label: "Purchase lists", href: "/account/purchase-lists" },
          { label: list.name },
        ]}
      />
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-col items-start gap-1">
          <h1 className="m-0 text-2xl font-bold">{list.name}</h1>
          <p className="m-0 text-sm text-gray-600">
            {list.lines.length} {list.lines.length === 1 ? "product" : "products"}, {items} {items === 1 ? "item" : "items"} · updated{" "}
            {date(list.lastModifiedAt)}
          </p>
          {/* Keyed by the name: a saved rename re-mounts it closed, with the new name. */}
          <RenameListForm key={list.name} listId={list.id} name={list.name} />
        </div>
        <DeleteListButton listId={list.id} name={list.name} />
      </div>
      {lines.length === 0 ? (
        <p className="m-0 rounded-md border border-gray-200 bg-white p-5 text-sm text-gray-600">
          This list is empty. Use &ldquo;Add to purchase list&rdquo; on a product page, in your cart or in Quick order.
        </p>
      ) : (
        <ListEditor listId={list.id} lines={lines} canOrder={context.canOrder} />
      )}
      {!context.canOrder && <p className="m-0 text-sm text-gray-600">Only associates with the buyer role can add lists to the cart.</p>}
    </div>
  );
}
