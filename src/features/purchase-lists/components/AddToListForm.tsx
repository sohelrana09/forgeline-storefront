"use client";

import { FormMessage } from "@/components/ui/PageMessages";
import { useActionState, useState } from "react";
import { addProductToListAction, saveCartToListAction } from "@/features/purchase-lists/actions";
import { MAX_QUANTITY } from "@/features/purchase-lists/utils";
import type { ListActionState } from "@/features/purchase-lists/types";

type ListOption = { id: string; name: string };

// Which list: one of the customer's lists, or a new one named here.
// `nameRequired` false when the fields sit inside another form (quick order), whose own submit must not be blocked;
// the server action checks the name either way.
export function ListTargetFields({
  lists,
  idPrefix,
  nameRequired = true,
}: {
  lists: ListOption[];
  idPrefix: string;
  nameRequired?: boolean;
}) {
  const [choice, setChoice] = useState(lists[0]?.id ?? "new");
  return (
    <>
      <label className="flex flex-col gap-1 text-sm font-semibold" htmlFor={`${idPrefix}-list`}>
        Purchase list
        <select
          id={`${idPrefix}-list`}
          name="listId"
          value={choice}
          onChange={(e) => setChoice(e.target.value)}
          className="min-h-11 rounded border border-gray-300 bg-white px-3 font-normal"
        >
          {lists.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
          <option value="new">New list…</option>
        </select>
      </label>
      {choice === "new" && (
        <label className="flex flex-col gap-1 text-sm font-semibold" htmlFor={`${idPrefix}-name`}>
          New list name
          <input
            id={`${idPrefix}-name`}
            name="newName"
            required={nameRequired}
            maxLength={100}
            placeholder="e.g. Monthly filters"
            className="min-h-11 rounded border border-gray-300 px-3 font-normal"
          />
        </label>
      )}
    </>
  );
}

export function ListResult({ state }: { state: ListActionState }) {
  return (
    <FormMessage
      state={state}
      error={state.error}
      success={state.saved}
      link={{ href: "/account/purchase-lists", label: "View purchase lists" }}
    />
  );
}

// Product page (one SKU with a quantity) or cart page (every cart line).
export function AddToListForm({ lists, sku, kind }: { lists: ListOption[]; sku?: string; kind: "product" | "cart" }) {
  const [state, action, pending] = useActionState(
    kind === "product" ? addProductToListAction : saveCartToListAction,
    {} as ListActionState,
  );
  return (
    <form action={action} className="flex flex-col gap-3">
      {sku && <input type="hidden" name="sku" value={sku} />}
      {/* Re-mounted when the lists change, so a list made here is not created again by a second click. */}
      <ListTargetFields key={lists.map((l) => l.id).join()} lists={lists} idPrefix={`${kind}-to-list`} />
      {kind === "product" && (
        <label className="flex flex-col gap-1 text-sm font-semibold" htmlFor="product-to-list-qty">
          Quantity
          <input
            id="product-to-list-qty"
            name="quantity"
            type="number"
            min={1}
            max={MAX_QUANTITY}
            defaultValue={1}
            required
            className="min-h-11 w-32 rounded border border-gray-300 px-3 font-normal"
          />
        </label>
      )}
      <ListResult state={state} />
      <button
        disabled={pending}
        className="min-h-11 self-start rounded border border-gray-900 bg-white px-5 font-semibold text-gray-900 hover:bg-gray-50 disabled:opacity-60"
      >
        {pending ? "Saving…" : kind === "product" ? "Add to purchase list" : "Save cart to purchase list"}
      </button>
    </form>
  );
}
