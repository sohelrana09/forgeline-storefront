import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireBusinessContext } from "@/features/business-units/context";
import { can } from "@/features/company/utils";
import { ApprovalsListView } from "@/features/approvals/components/ApprovalsListView";
import { listParams } from "@/components/ui/ListToolbar";

export const metadata: Metadata = { title: "Order approvals" };

type Search = { view?: string; page?: string; limit?: string };

export default async function ApprovalsPage({ searchParams }: { searchParams: Promise<Search> }) {
  const [{ session, context }, { view, page, limit }] = await Promise.all([requireBusinessContext(), searchParams]);
  if (!can(context, "UpdateApprovalFlows")) redirect("/account");
  return <ApprovalsListView session={session} context={context} view={view === "all" ? "all" : "pending"} {...listParams(page, limit)} />;
}
