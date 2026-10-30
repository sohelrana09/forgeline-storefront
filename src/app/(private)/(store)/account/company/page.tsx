import type { Metadata } from "next";
import { requireBusinessContext } from "@/features/business-units/context";
import { CompanyProfileView } from "@/features/company/components/CompanyProfileView";

export const metadata: Metadata = { title: "Company profile" };

export default async function CompanyProfilePage() {
  const { session, context } = await requireBusinessContext();
  return <CompanyProfileView session={session} context={context} />;
}
