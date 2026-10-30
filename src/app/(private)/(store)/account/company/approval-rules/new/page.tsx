import { redirect } from "next/navigation";
import { requireBusinessContext } from "@/features/business-units/context";
import { can } from "@/features/company/utils";
import { getRoles } from "@/features/company/service";
import { ApprovalRuleForm } from "@/features/company/components/ApprovalRuleForm";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";

export default async function NewApprovalRulePage() {
  const { context } = await requireBusinessContext();
  if (!can(context, "CreateApprovalRules")) redirect("/account/company/approval-rules");
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
          { label: "New rule" },
        ]}
      />
      <h1 className="m-0 text-2xl font-bold">New approval rule</h1>
      <ApprovalRuleForm roles={roles} currency={context.currency} />
    </div>
  );
}
