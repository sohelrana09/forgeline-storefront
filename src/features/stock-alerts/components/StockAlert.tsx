import Link from "next/link";
import type { BrowseContext } from "@/features/business-units/context";
import { stockAlertsEnabled } from "@/features/stock-alerts/alerts";
import { hasAlert } from "@/features/stock-alerts/service";
import { StockAlertForm } from "@/features/stock-alerts/components/StockAlertForm";

// Product page, out-of-stock variant: "Email me when it's back" for signed-in customers.
export async function StockAlert({ sku, session }: { sku: string; session: BrowseContext["session"] }) {
  if (!stockAlertsEnabled()) return null;
  if (!session) {
    return (
      <p className="m-0 text-sm">
        <Link href="/login">Sign in</Link> to get an email when it&apos;s back in stock.
      </p>
    );
  }
  return <StockAlertForm sku={sku} following={await hasAlert(session.customerId, sku)} />;
}
