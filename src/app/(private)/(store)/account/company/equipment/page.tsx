import type { Metadata } from "next";
import { requireBusinessContext } from "@/features/business-units/context";
import { EquipmentView } from "@/features/fitment/components/EquipmentView";

export const metadata: Metadata = { title: "My equipment" };

export default async function EquipmentPage() {
  const { session, context } = await requireBusinessContext();
  return <EquipmentView session={session} context={context} />;
}
