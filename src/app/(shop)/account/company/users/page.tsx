import { requireBusinessContext } from "@/features/business-units/context";
import { CompanyUsersView } from "@/features/company/components/CompanyUsersView";

export const dynamic = "force-dynamic";

export default async function CompanyUsersPage() {
  const { session, context } = await requireBusinessContext();
  return <CompanyUsersView session={session} context={context} />;
}
