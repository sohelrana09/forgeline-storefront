"use client";

import { useActionState, useRef } from "react";
import { quickOrder } from "@/features/quick-order/actions";
import { addQuickOrderToListAction } from "@/features/purchase-lists/actions";
import { ListResult, ListTargetFields } from "@/features/purchase-lists/components/AddToListForm";
import type { ListActionState } from "@/features/purchase-lists/types";
import type { QuickOrderState } from "@/features/quick-order/types";

const initial: QuickOrderState = { added: [], errors: [] };

// `lists`: the signed-in customer's purchase lists; the pasted lines can go to one of them instead of the cart.
export function QuickOrderForm({ lists }: { lists?: { id: string; name: string }[] }) {
  const [state, action, pending] = useActionState(quickOrder, initial);
  const [listState, listAction, listPending] = useActionState(addQuickOrderToListAction, {} as ListActionState);
  const listButton = useRef<HTMLButtonElement>(null);
  const lineCount = state.added.length;

  return (
    <form action={action} className="flex flex-col gap-3">
      <label htmlFor="qo-lines" className="text-xs font-semibold">
        Order lines
      </label>
      <textarea
        // Re-mount after each submit so the box shows only the lines that still need fixing.
        key={JSON.stringify(state)}
        id="qo-lines"
        name="lines"
        rows={7}
        defaultValue={state.submitted ?? "air-filter, 24\noil-filter, 24\nhydraulic-hose, 6\nfuel-filter, 12"}
        className="resize-y rounded border border-gray-300 p-2.5 font-mono text-[13px]"
        aria-describedby="qo-help qo-result"
      />
      <p id="qo-help" className="m-0 text-xs text-gray-600">
        One line per item: SKU, quantity. Duplicate SKUs are combined.
      </p>
      <button disabled={pending} className="min-h-11 rounded bg-orange-700 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60">
        {pending ? "Adding…" : "Add all to cart"}
      </button>
      {lists && (
        <details
          className="rounded border border-gray-200 p-3"
          // Enter in the list fields submits to the list; the form's default button would add to the cart.
          onKeyDown={(e) => {
            if (e.key === "Enter" && e.target instanceof HTMLInputElement) {
              e.preventDefault();
              listButton.current?.form?.requestSubmit(listButton.current);
            }
          }}
        >
          <summary className="cursor-pointer text-sm font-semibold">Add these lines to a purchase list</summary>
          <div className="mt-3 flex flex-col gap-3">
            <ListTargetFields key={lists.map((l) => l.id).join()} lists={lists} idPrefix="qo-to-list" nameRequired={false} />
            <ListResult state={listState} />
            <button
              ref={listButton}
              formAction={listAction}
              disabled={listPending}
              className="min-h-11 self-start rounded border border-gray-900 bg-white px-5 text-sm font-semibold text-gray-900 hover:bg-gray-50 disabled:opacity-60"
            >
              {listPending ? "Saving…" : "Add to purchase list"}
            </button>
          </div>
        </details>
      )}

      <div id="qo-result" aria-live="polite" className="flex flex-col gap-2 text-sm">
        {lineCount > 0 && (
          <div className="rounded border border-green-200 bg-green-50 p-3 text-green-900">
            Added {lineCount} {lineCount === 1 ? "line" : "lines"} to the cart:
            <ul className="m-0 mt-1 list-none p-0">
              {state.added.map((l) => (
                <li key={l.sku}>
                  {l.quantity} × {l.name} <span className="font-mono text-xs">({l.sku})</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {state.errors.length > 0 && (
          <div className="rounded border border-red-200 bg-red-50 p-3 text-red-900">
            <strong>Not added:</strong>
            <ul className="m-0 mt-1 list-none p-0">
              {state.errors.map((e, i) => (
                <li key={i}>
                  {e.line > 0 && `Line ${e.line}: `}
                  {e.text && <span className="font-mono text-xs">{e.text}</span>} {e.reason}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </form>
  );
}
