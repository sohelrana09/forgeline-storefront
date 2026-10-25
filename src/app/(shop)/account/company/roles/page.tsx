import { requireBusinessContext } from "@/features/business-units/context";
import { RolesView } from "@/features/company/components/RolesView";

export const dynamic = "force-dynamic";

export default async function RolesPage() {
  const { context } = await requireBusinessContext();
  return <RolesView context={context} />;
}
