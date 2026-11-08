import { createHash } from "node:crypto";

// Back-in-stock alerts (docs/features/b2c-engagement.md), pure and unit-tested. A signed-in customer asks to be told
// when an out-of-stock variant is back in their store; one Custom Object per customer and SKU (container
// stock-alerts) holds the request without the email address (it is read from the customer when the mail goes out).
// A daily cron sends the mails and removes the alerts; unsent ones expire after ALERT_DAYS.

export const stockAlertsEnabled = (env: Record<string, string | undefined> = process.env) => env.STOCK_ALERTS === "true";

export const ALERT_CONTAINER = "stock-alerts";
export const ALERT_DAYS = 90;
export const ALERTS_PER_CUSTOMER = 50;

export type StockAlert = {
  sku: string;
  customerId: string;
  storeKey: string;
  supplyChannelId?: string;
  productSlug: string;
  createdAt: string;
};

export const alertKey = (customerId: string, sku: string) => createHash("sha256").update(`${customerId}|${sku}`).digest("hex");

export function parseAlert(value: unknown): StockAlert | undefined {
  const v = value as Partial<StockAlert> | undefined;
  return v &&
    typeof v.sku === "string" &&
    typeof v.customerId === "string" &&
    typeof v.storeKey === "string" &&
    typeof v.productSlug === "string" &&
    typeof v.createdAt === "string"
    ? (v as StockAlert)
    : undefined;
}

export type AlertOutcome = "send" | "wait" | "expire";

// Back in stock: send. Out of stock: wait, until the alert is ALERT_DAYS old. A product no longer sold there: expire.
export function alertOutcome(alert: StockAlert, available: number | undefined | null, now: Date): AlertOutcome {
  if (available === null) return "expire";
  if (available !== undefined && available > 0) return "send";
  const age = now.getTime() - new Date(alert.createdAt).getTime();
  return age > ALERT_DAYS * 24 * 60 * 60 * 1000 ? "expire" : "wait";
}
