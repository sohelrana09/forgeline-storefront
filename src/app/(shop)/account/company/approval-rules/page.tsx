import { redirect } from "next/navigation";
import { requireBusinessContext } from "@/features/business-units/context";
import { can } from "@/features/company/utils";
import { ApprovalRulesView } from "@/features/company/components/ApprovalRulesView";

export const dynamic = "force-dynamic";

export default async function ApprovalRulesPage({ searchParams }: { searchParams: Promise<{ saved?: string }> }) {
  const [{ session, context }, { saved }] = await Promise.all([requireBusinessContext(), searchParams]);
  if (!can(context, "CreateApprovalRules") && !can(context, "UpdateApprovalRules")) redirect("/account");
  return <ApprovalRulesView session={session} context={context} saved={saved === "1"} />;
}
