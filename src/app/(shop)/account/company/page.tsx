import { requireBusinessContext } from "@/features/business-units/context";
import { CompanyProfileView } from "@/features/company/components/CompanyProfileView";

export const dynamic = "force-dynamic";

export default async function CompanyProfilePage() {
  const { session, context } = await requireBusinessContext();
  return <CompanyProfileView session={session} context={context} />;
}
