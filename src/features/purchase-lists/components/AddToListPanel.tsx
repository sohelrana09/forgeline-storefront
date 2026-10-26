import { isRedirectError } from "next/dist/client/components/redirect-error";
import { getSession } from "@/features/auth/session";
import { listNames } from "@/features/purchase-lists/service";
import { AddToListForm } from "@/features/purchase-lists/components/AddToListForm";
import type { BuyerContext } from "@/features/business-units/types";

// "Add to purchase list" under Add to cart (product page) or the cart summary. Signed-in customers only: guests,
// including every cached guest page, return before any cookie is read.
export async function AddToListPanel({ context, kind, sku }: { context: BuyerContext; kind: "product" | "cart"; sku?: string }) {
  if (context.guest) return null;
  const session = await getSession();
  if (!session) return null;
  const lists = await listNames(session, context).catch((err) => {
    if (isRedirectError(err)) throw err;
    return [];
  });
  return (
    <details className="rounded-md border border-gray-200 bg-white p-4">
      <summary className="cursor-pointer text-sm font-semibold">
        {kind === "product" ? "Add to purchase list" : "Save cart to purchase list"}
      </summary>
      <div className="mt-3">
        <AddToListForm lists={lists} sku={sku} kind={kind} />
      </div>
    </details>
  );
}
