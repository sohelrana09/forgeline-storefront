import type { Metadata } from "next";
import { requireBusinessContext } from "@/features/business-units/context";
import { RolesView } from "@/features/company/components/RolesView";

export const metadata: Metadata = { title: "Roles and permissions" };

export default async function RolesPage() {
  const { context } = await requireBusinessContext();
  return <RolesView context={context} />;
}
