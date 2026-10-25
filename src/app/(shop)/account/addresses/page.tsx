import { requireShopContext } from "@/features/business-units/context";
import { AddressBookView } from "@/features/account/components/AddressBookView";

export const dynamic = "force-dynamic";

export default async function AddressBookPage() {
  const { session, context } = await requireShopContext();
  return <AddressBookView session={session} context={context} />;
}
