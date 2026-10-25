import { requireShopContext } from "@/features/business-units/context";
import { AccountInformationView } from "@/features/account/components/AccountInformationView";

export const dynamic = "force-dynamic";

export default async function AccountInformationPage() {
  const { session } = await requireShopContext();
  return <AccountInformationView session={session} />;
}
