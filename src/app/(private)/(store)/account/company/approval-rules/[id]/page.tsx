import { notFound, redirect } from "next/navigation";
import { requireBusinessContext } from "@/features/business-units/context";
import { can } from "@/features/company/utils";
import { CompanyError, getRoles } from "@/features/company/service";
import { getApprovalRule } from "@/features/company/approval-rules";
import { ApprovalRuleForm } from "@/features/company/components/ApprovalRuleForm";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";

export default async function EditApprovalRulePage({ params }: { params: Promise<{ id: string }> }) {
  const [{ session, context }, { id }] = await Promise.all([requireBusinessContext(), params]);
  if (!can(context, "UpdateApprovalRules")) redirect("/account/company/approval-rules");
  const rule = await getApprovalRule(context, session.customerId, id).catch((err) => {
    if (err instanceof CompanyError) redirect("/account/company/approval-rules");
    throw err;
  });
  // The form edits "order total above" rules with one approval step only.
  if (!rule || rule.amount === undefined || rule.steps !== 1) notFound();
  const roles = (await getRoles()).map((r) => ({
    key: r.key,
    name: r.name,
    canApprove: r.permissions.includes("UpdateApprovalFlows"),
  }));
  return (
    <div className="flex flex-col gap-4">
      <Breadcrumbs
        items={[
          { label: "My account", href: "/account" },
          { label: "Approval rules", href: "/account/company/approval-rules" },
          { label: rule.name },
        ]}
      />
      <h1 className="m-0 text-2xl font-bold">Edit approval rule</h1>
      <ApprovalRuleForm rule={rule} roles={roles} currency={context.currency} />
    </div>
  );
}
