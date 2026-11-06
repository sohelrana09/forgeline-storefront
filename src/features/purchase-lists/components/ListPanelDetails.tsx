"use client";

import { useState } from "react";
import { listNamesAction } from "@/features/purchase-lists/actions";
import { AddToListForm } from "@/features/purchase-lists/components/AddToListForm";

// The panel's <details>; the buyer's lists are read the first time it opens.
export function ListPanelDetails({ kind, sku }: { kind: "product" | "cart"; sku?: string }) {
  const [lists, setLists] = useState<{ id: string; name: string }[]>();
  return (
    <details
      className="rounded-md border border-gray-200 bg-white p-4"
      onToggle={(e) => {
        if (e.currentTarget.open && !lists) listNamesAction().then(setLists, () => setLists([]));
      }}
    >
      <summary className="cursor-pointer text-sm font-semibold">
        {kind === "product" ? "Add to purchase list" : "Save cart to purchase list"}
      </summary>
      <div className="mt-3">
        {lists ? <AddToListForm lists={lists} sku={sku} kind={kind} /> : <p className="m-0 text-sm text-gray-600">Loading your lists…</p>}
      </div>
    </details>
  );
}
