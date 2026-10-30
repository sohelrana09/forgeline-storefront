import type { Metadata } from "next";
import { requireBusinessContext } from "@/features/business-units/context";
import { CompanyStructureView } from "@/features/company/components/CompanyStructureView";

export const metadata: Metadata = { title: "Company structure" };

export default async function CompanyStructurePage() {
  const { session, context } = await requireBusinessContext();
  return <CompanyStructureView session={session} context={context} />;
}
