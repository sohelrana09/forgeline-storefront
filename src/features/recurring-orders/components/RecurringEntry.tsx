import { recurrencePolicies } from "@/features/recurring-orders/service";
import { firstRunWindow, recurringOrdersEnabled } from "@/features/recurring-orders/schedule";
import { CreateRecurringForm } from "@/features/recurring-orders/components/RecurringForms";
import type { BuyerContext } from "@/features/business-units/types";

// "Repeat on a schedule" on an order or a purchase list, for business buyers who may order (RECURRING_ORDERS=true).
// Streams in behind a <Suspense>: it reads the project's recurrence policies.
export async function RecurringEntry({
  context,
  sourceKind,
  sourceId,
  listScope,
}: {
  context: BuyerContext;
  sourceKind: "order" | "list";
  sourceId: string;
  listScope?: "mine" | "company";
}) {
  if (!recurringOrdersEnabled() || context.consumer || context.guest || !context.canOrder) return null;
  const policies = await recurrencePolicies().catch((err) => {
    console.error("recurrence policies failed", (err as { body?: unknown })?.body ?? err);
    return [];
  });
  if (policies.length === 0) return null;
  return (
    <details className="rounded-md border border-gray-200 bg-white p-4 text-sm">
      <summary className="min-h-11 cursor-pointer content-center font-semibold">
        Repeat {sourceKind === "order" ? "this order" : "this list"} on a schedule
      </summary>
      <p className="m-0 my-2 text-gray-600">
        We place the order for you at each day&apos;s prices and email you two days before. Pause, skip or cancel at any time in My
        recurring orders.
      </p>
      <CreateRecurringForm
        sourceKind={sourceKind}
        sourceId={sourceId}
        listScope={listScope}
        policies={policies}
        {...firstRunWindow(new Date())}
      />
    </details>
  );
}
