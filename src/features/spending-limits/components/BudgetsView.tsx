import { budgetMoney, budgetOverview, budgetStatuses } from "@/features/spending-limits/service";
import { amountInput, currencyDigits } from "@/features/spending-limits/budget";
import { getCompanyMembers } from "@/features/company/service";
import { can } from "@/features/company/utils";
import { BudgetLines } from "@/features/spending-limits/components/BudgetNotice";
import { BudgetsForm, type BudgetRow } from "@/features/spending-limits/components/BudgetsForm";
import type { Session } from "@/features/auth/session";
import type { BuyerContext } from "@/features/business-units/types";

// /account/company/budgets: every member sees what is left of the budgets that apply to them; admins
// (UpdateBusinessUnitDetails, checked live by budgetOverview) see everyone's spending and edit the budgets.
export async function BudgetsView({ session, context }: { session: Session; context: BuyerContext }) {
  const money = budgetMoney(context);
  const mine = await budgetStatuses(context, session.customerId);
  const admin = can(context, "UpdateBusinessUnitDetails");
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="m-0 text-2xl font-bold">Budgets</h1>
        <p className="m-0 mt-1 text-sm text-gray-600">
          Spending limits for {context.businessUnitName}, counted from orders placed this month or quarter (net, cancelled orders excluded).
        </p>
      </div>
      <section aria-labelledby="my-budget" className="rounded-md border border-gray-200 bg-white p-5 text-sm">
        <h2 id="my-budget" className="m-0 mb-2 text-lg font-semibold">
          What you can still spend
        </h2>
        {mine.length > 0 ? <BudgetLines statuses={mine} money={money} /> : <p className="m-0">No budget limits your orders.</p>}
      </section>
      {admin && <AdminBudgets session={session} context={context} />}
    </div>
  );
}

async function AdminBudgets({ session, context }: { session: Session; context: BuyerContext }) {
  const [overview, members] = await Promise.all([
    budgetOverview(context, session.customerId),
    getCompanyMembers(context, session.customerId),
  ]);
  const money = budgetMoney(context);
  const digits = currencyDigits(context.currency);
  const row = (id: string, label: string, rule = id === "unit" ? overview.doc.unit : overview.doc.buyers[id]): BudgetRow => {
    const s = id === "unit" ? overview.unit : overview.buyers[id];
    return { id, label, rule, amount: rule ? amountInput(rule.centAmount, digits) : "", spent: s ? money(s.spent) : undefined };
  };
  return (
    <section aria-labelledby="edit-budgets" className="rounded-md border border-gray-200 bg-white p-5">
      <h2 id="edit-budgets" className="m-0 mb-1 text-lg font-semibold">
        Set budgets
      </h2>
      <p className="m-0 mb-4 text-sm text-gray-600">
        A company budget counts every user&apos;s orders; a user&apos;s own budget counts theirs. When both apply, an order must fit both.
      </p>
      <BudgetsForm
        currency={context.currency}
        unit={row("unit", "Whole company")}
        buyers={members.map((m) => row(m.customerId, m.name || m.email || "Company user"))}
      />
    </section>
  );
}
