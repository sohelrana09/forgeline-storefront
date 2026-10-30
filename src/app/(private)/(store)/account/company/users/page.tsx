import type { Metadata } from "next";
import { requireBusinessContext } from "@/features/business-units/context";
import { CompanyUsersView } from "@/features/company/components/CompanyUsersView";

export const metadata: Metadata = { title: "Company users" };

export default async function CompanyUsersPage() {
  const { session, context } = await requireBusinessContext();
  return <CompanyUsersView session={session} context={context} />;
}
