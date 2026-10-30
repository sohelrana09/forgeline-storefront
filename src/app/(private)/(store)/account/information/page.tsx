import type { Metadata } from "next";
import { requireShopContext } from "@/features/business-units/context";
import { AccountInformationView } from "@/features/account/components/AccountInformationView";

export const metadata: Metadata = { title: "Account information" };

export default async function AccountInformationPage() {
  const { session } = await requireShopContext();
  return <AccountInformationView session={session} />;
}
