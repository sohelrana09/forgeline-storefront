import type { Metadata } from "next";
import { requireShopContext } from "@/features/business-units/context";
import { AccountNav } from "@/features/account/components/AccountNav";
import { can } from "@/features/company/utils";
import { spendingLimitsEnabled } from "@/features/spending-limits/budget";
import { recurringOrdersEnabled } from "@/features/recurring-orders/schedule";
import { sharedCartsEnabled } from "@/features/shared-carts/share";

export const metadata: Metadata = { robots: { index: false, follow: false } };

// Signed-in only (every page below also calls requireShopContext: a layout is not a security boundary).
export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const { context } = await requireShopContext();
  return (
    <div className="flex flex-wrap items-start gap-6">
      <aside className="w-full rounded-md border border-gray-200 bg-white py-2 md:w-60 md:flex-none">
        <AccountNav
          business={!context.consumer}
          approver={can(context, "UpdateApprovalFlows")}
          ruleManager={can(context, "CreateApprovalRules") || can(context, "UpdateApprovalRules")}
          optional={[
            ...(spendingLimitsEnabled() ? ["/account/company/budgets"] : []),
            ...(recurringOrdersEnabled() ? ["/account/recurring-orders"] : []),
            // Only for those who may review colleagues' carts (the page re-checks live).
            ...(sharedCartsEnabled() && can(context, "ViewOthersCarts") ? ["/account/shared-carts"] : []),
          ]}
        />
      </aside>
      <div className="min-w-0 flex-[999_1_600px]">{children}</div>
    </div>
  );
}
