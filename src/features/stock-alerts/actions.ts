"use server";

// Public endpoints for back-in-stock alerts: the switch, a signed-in customer, a rate limit, a SKU check, then the
// service (which checks the variant is sold to them and out of stock).

import { refresh } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { tooManyAttempts } from "@/lib/rate-limit";
import { requireShopContext } from "@/features/business-units/context";
import { stockAlertsEnabled } from "@/features/stock-alerts/alerts";
import { StockAlertError, createAlert, removeAlert } from "@/features/stock-alerts/service";

export type StockAlertState = { error?: string; saved?: string };

export async function stockAlertAction(_prev: StockAlertState, formData: FormData): Promise<StockAlertState> {
  if (!stockAlertsEnabled()) return { error: "Stock alerts are not available." };
  const { session, context } = await requireShopContext();
  if (await tooManyAttempts(`stock-alert:${session.customerId}`, 30)) return { error: "Too many requests. Please wait a few minutes." };
  const sku = String(formData.get("sku") ?? "");
  if (!/^[A-Za-z0-9._-]{1,64}$/.test(sku)) return { error: "The form is out of date. Please reload." };
  try {
    if (formData.get("intent") === "remove") {
      await removeAlert(session.customerId, sku);
      refresh();
      return { saved: "We won't email you about this product." };
    }
    await createAlert(session.customerId, context, sku);
    refresh();
    return { saved: "We'll email you once it's back in stock." };
  } catch (err) {
    unstable_rethrow(err);
    if (err instanceof StockAlertError) return { error: err.message };
    if ((err as { body?: { statusCode?: number } })?.body?.statusCode === 409) return { saved: "We'll email you once it's back in stock." };
    console.error("stock alert failed", (err as { body?: unknown })?.body ?? err);
    return { error: "That didn't work. Please try again." };
  }
}
