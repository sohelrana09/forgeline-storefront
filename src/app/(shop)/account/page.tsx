import { requireShopContext } from "@/features/business-units/context";
import { AccountDashboardView } from "@/features/account/components/AccountDashboardView";

export const dynamic = "force-dynamic";

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ email?: string; joined?: string }> }) {
  const [{ email, joined }, { session, context }] = await Promise.all([searchParams, requireShopContext()]);
  return <AccountDashboardView session={session} context={context} emailNotice={email === "verified" || email === "invalid" ? email : undefined} joined={joined === "1"} />;
}
