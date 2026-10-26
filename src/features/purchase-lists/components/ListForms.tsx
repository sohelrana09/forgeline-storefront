"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { formatMoney } from "@/lib/utils";
import {
  addListToCartAction,
  createListAction,
  deleteListAction,
  renameListAction,
  updateListAction,
} from "@/features/purchase-lists/actions";
import { MAX_QUANTITY } from "@/features/purchase-lists/utils";
import type { ListActionState } from "@/features/purchase-lists/types";
import type { QuickOrderState } from "@/features/quick-order/types";

export function CreateListForm() {
  const [state, action, pending] = useActionState(createListAction, {} as ListActionState);
  return (
    <form action={action} className="flex flex-wrap items-end gap-3">
      <label className="flex min-w-0 flex-[1_1_240px] flex-col gap-1 text-sm font-semibold">
        New list name
        <input
          name="name"
          required
          maxLength={100}
          placeholder="e.g. Monthly filters"
          className="min-h-11 rounded border border-gray-300 px-3 font-normal"
        />
      </label>
      <button
        disabled={pending}
        className="min-h-11 rounded bg-orange-700 px-5 font-semibold text-white hover:bg-orange-800 disabled:opacity-60"
      >
        {pending ? "Creating…" : "Create list"}
      </button>
      {state.error && (
        <p role="alert" className="m-0 w-full rounded border border-red-200 bg-red-50 p-3 text-sm text-red-900">
          {state.error}
        </p>
      )}
    </form>
  );
}

export function RenameListForm({ listId, name }: { listId: string; name: string }) {
  const [state, action, pending] = useActionState(renameListAction, {} as ListActionState);
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="text-sm font-semibold text-orange-800">
        Rename
      </button>
    );
  }
  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="listId" value={listId} />
      <label className="flex flex-col gap-1 text-sm font-semibold">
        List name
        <input
          name="name"
          required
          maxLength={100}
          defaultValue={name}
          autoFocus
          className="min-h-11 rounded border border-gray-300 px-3 font-normal"
        />
      </label>
      <button disabled={pending} className="min-h-11 rounded border border-gray-900 px-4 text-sm font-semibold">
        {pending ? "Saving…" : "Save name"}
      </button>
      <button type="button" onClick={() => setOpen(false)} className="min-h-11 px-2 text-sm">
        Cancel
      </button>
      {state.error && (
        <p role="alert" className="m-0 w-full text-sm text-red-900">
          {state.error}
        </p>
      )}
    </form>
  );
}

export type EditorLine = {
  id: string;
  sku?: string;
  name: string;
  quantity: number;
  available: boolean;
  slug?: string;
  image?: string;
  price?: { centAmount: number; currencyCode: string; fractionDigits: number };
  // Why it can't go into the cart for this unit, if it can't.
  note?: string;
  quoteOnly: boolean;
};

// The list's lines in one table (Magento requisition list): tick lines and add them (or all) to the cart, or edit
// quantities / remove lines and update the list. The two actions use separate forms over the same rows.
export function ListEditor({ listId, lines, canOrder }: { listId: string; lines: EditorLine[]; canOrder: boolean }) {
  const [updateState, updateAction, updating] = useActionState(updateListAction, {} as ListActionState);
  const [cartState, cartAction, adding] = useActionState(addListToCartAction, {
    added: [],
    errors: [],
  } as QuickOrderState);
  const updateForm = `update-${listId}`;
  const cartForm = `cart-${listId}`;
  return (
    <div className="flex flex-col gap-4">
      <form id={updateForm} action={updateAction}>
        <input type="hidden" name="listId" value={listId} />
      </form>
      <form id={cartForm} action={cartAction}>
        <input type="hidden" name="listId" value={listId} />
      </form>
      <div className="relative overflow-x-auto rounded-md border border-gray-200 bg-white">
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-gray-600">
              {canOrder && (
                <th className="w-10 px-4 py-2.5">
                  <span className="sr-only">Select</span>
                </th>
              )}
              <th className="px-3 py-2.5 font-semibold">Product</th>
              <th className="px-3 py-2.5 text-right font-semibold">Price</th>
              <th className="px-3 py-2.5 font-semibold">Qty</th>
              <th className="px-4 py-2.5 font-semibold">Remove</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l) => (
              <tr key={l.id} className="border-t border-gray-100 align-top">
                {canOrder && (
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      name="line"
                      value={l.id}
                      form={cartForm}
                      disabled={!l.available || Boolean(l.note)}
                      aria-label={`Select ${l.name}`}
                      className="mt-1 size-4"
                    />
                  </td>
                )}
                <td className="px-3 py-3">
                  <div className="flex items-start gap-3">
                    {l.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={l.image}
                        alt=""
                        width={48}
                        height={48}
                        className="size-12 shrink-0 rounded border border-gray-100 object-contain"
                      />
                    ) : (
                      <span className="size-12 shrink-0 rounded bg-gray-100" />
                    )}
                    <div className="flex min-w-0 flex-col">
                      {l.slug && l.available ? (
                        <Link href={`/p/${l.slug}?sku=${encodeURIComponent(l.sku ?? "")}`} className="font-semibold text-gray-900">
                          {l.name}
                        </Link>
                      ) : (
                        <span className="font-semibold">{l.name}</span>
                      )}
                      {l.sku && <span className="font-mono text-xs text-gray-600">{l.sku}</span>}
                      {!l.available ? (
                        <span className="text-xs text-red-800">No longer available</span>
                      ) : l.note ? (
                        <span className="text-xs text-red-800">{l.note}</span>
                      ) : (
                        l.quoteOnly && <span className="text-xs text-gray-600">Goes into the cart for a quote</span>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-3 py-3 text-right">{l.price ? formatMoney(l.price) : "None"}</td>
                <td className="px-3 py-3">
                  <input
                    type="number"
                    name={`qty-${l.id}`}
                    form={updateForm}
                    min={1}
                    max={MAX_QUANTITY}
                    defaultValue={l.quantity}
                    aria-label={`Quantity of ${l.name}`}
                    className="min-h-11 w-24 rounded border border-gray-300 px-2"
                  />
                </td>
                <td className="px-4 py-3">
                  <input
                    type="checkbox"
                    name="remove"
                    value={l.id}
                    form={updateForm}
                    aria-label={`Remove ${l.name}`}
                    className="mt-1 size-4"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {updateState.error && (
        <p role="alert" className="m-0 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-900">
          {updateState.error}
        </p>
      )}
      {updateState.saved && (
        <p role="status" className="m-0 rounded border border-green-200 bg-green-50 p-3 text-sm text-green-900">
          {updateState.saved}
        </p>
      )}
      {cartState.added.length > 0 && (
        <p role="status" className="m-0 rounded border border-green-200 bg-green-50 p-3 text-sm text-green-900">
          Added {cartState.added.length} {cartState.added.length === 1 ? "product" : "products"} to your cart.{" "}
          <Link href="/cart" className="font-semibold text-green-900">
            Go to cart
          </Link>
        </p>
      )}
      {cartState.errors.length > 0 && (
        <div role="alert" className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-900">
          <strong>Not added:</strong>
          <ul className="m-0 mt-1 list-none p-0">
            {cartState.errors.map((e, i) => (
              <li key={i}>
                {e.text && <span className="font-mono text-xs">{e.text}</span>} {e.reason}
              </li>
            ))}
          </ul>
        </div>
      )}
      {canOrder && (
        <p className="m-0 text-xs text-gray-600">
          Adding to the cart uses the saved quantities: update the list first after changing them.
        </p>
      )}
      <div className="flex flex-wrap gap-3">
        {canOrder && (
          <>
            <button
              form={cartForm}
              disabled={adding}
              className="min-h-11 rounded border border-gray-900 bg-white px-5 font-semibold text-gray-900 hover:bg-gray-50 disabled:opacity-60"
            >
              {adding ? "Adding…" : "Add selected to cart"}
            </button>
            <button
              form={cartForm}
              name="scope"
              value="all"
              disabled={adding}
              className="min-h-11 rounded bg-orange-700 px-5 font-semibold text-white hover:bg-orange-800 disabled:opacity-60"
            >
              Add all to cart
            </button>
          </>
        )}
        <button
          form={updateForm}
          disabled={updating}
          className="min-h-11 rounded border border-gray-300 bg-white px-5 font-semibold text-gray-800 hover:bg-gray-50 disabled:opacity-60"
        >
          {updating ? "Saving…" : "Update list"}
        </button>
      </div>
    </div>
  );
}

// Deleting can't be undone: ask once before submitting.
export function DeleteListButton({ listId, name }: { listId: string; name: string }) {
  const [state, action, pending] = useActionState(deleteListAction, {} as ListActionState);
  const [confirming, setConfirming] = useState(false);
  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="min-h-11 rounded border border-red-300 bg-white px-4 text-sm font-semibold text-red-800 hover:bg-red-50"
      >
        Delete list
      </button>
    );
  }
  return (
    <form action={action} className="flex flex-wrap items-center gap-2 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-900">
      <input type="hidden" name="listId" value={listId} />
      <span>Delete &ldquo;{name}&rdquo;? This can&apos;t be undone.</span>
      <button disabled={pending} className="min-h-11 rounded bg-red-700 px-4 font-semibold text-white disabled:opacity-60">
        {pending ? "Deleting…" : "Yes, delete"}
      </button>
      <button
        type="button"
        onClick={() => setConfirming(false)}
        className="min-h-11 rounded border border-gray-300 bg-white px-4 font-semibold text-gray-800"
      >
        Cancel
      </button>
      {state.error && (
        <p role="alert" className="m-0 w-full">
          {state.error}
        </p>
      )}
    </form>
  );
}
