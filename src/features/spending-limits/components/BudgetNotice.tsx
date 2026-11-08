import { budgetMoney, budgetStatuses } from "@/features/spending-limits/service";
import { decide, type BudgetStatus } from "@/features/spending-limits/budget";
import type { PricingContext } from "@/features/business-units/types";
import { Message } from "@/components/ui/Message";

const SCOPE = { unit: "Company budget", buyer: "Your budget" } as const;
const PERIOD = { monthly: "this month", quarterly: "this quarter" } as const;

export function BudgetLines({ statuses, money }: { statuses: BudgetStatus[]; money: (c: number) => string }) {
  return (
    <ul className="m-0 flex list-none flex-col gap-1 p-0">
      {statuses.map((s) => (
        <li key={s.scope}>
          <span className="font-semibold">{SCOPE[s.scope]}</span> {PERIOD[s.rule.period]}:{" "}
          {s.remaining >= 0
            ? `${money(s.remaining)} left of ${money(s.rule.centAmount)}`
            : `${money(-s.remaining)} over ${money(s.rule.centAmount)}`}
          <span className="text-gray-600">
            {" "}
            (net, {s.rule.mode === "block" ? "orders over it are blocked" : "orders over it are flagged"})
          </span>
        </li>
      ))}
    </ul>
  );
}

// What is left of the buyer's budgets, and whether `orderNet` (the cart's net total) fits. Streams in behind a
// <Suspense> on cart and checkout: it reads the unit's orders. Renders nothing without budgets.
export async function BudgetNotice({ context, customerId, orderNet }: { context: PricingContext; customerId: string; orderNet?: number }) {
  const statuses = await budgetStatuses(context, customerId).catch((err) => {
    console.error("budget status failed", (err as { body?: unknown })?.body ?? err);
    return [];
  });
  if (statuses.length === 0) return null;
  const money = budgetMoney(context);
  const d = orderNet === undefined ? undefined : decide(statuses, orderNet);
  const lines = <BudgetLines statuses={statuses} money={money} />;
  return (
    <section aria-label="Spending budget" className="text-sm">
      {d?.decision === "block" || d?.decision === "warn" ? (
        <Message type={d.decision === "block" ? "error" : "warning"}>
          {lines}
          <p className="m-0 mt-1">
            {d.decision === "block"
              ? "This cart is over budget and can't be ordered as it is."
              : "This cart is over budget. You can still order; your company admin will see it."}
          </p>
        </Message>
      ) : (
        <div className="rounded border border-gray-200 bg-gray-50 px-3 py-2">{lines}</div>
      )}
    </section>
  );
}
