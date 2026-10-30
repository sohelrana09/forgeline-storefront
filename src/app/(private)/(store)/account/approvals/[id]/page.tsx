import { redirect } from "next/navigation";
import { requireBusinessContext } from "@/features/business-units/context";
import { can } from "@/features/company/utils";
import { ApprovalView } from "@/features/approvals/components/ApprovalView";

export default async function ApprovalPage({ params }: { params: Promise<{ id: string }> }) {
  const [{ session, context }, { id }] = await Promise.all([requireBusinessContext(), params]);
  if (!can(context, "UpdateApprovalFlows")) redirect("/account");
  return <ApprovalView session={session} context={context} id={id} />;
}
