import type { Order } from "@commercetools/platform-sdk";
import type { Tone } from "@/components/ui/StateBadge";

// commercetools order states with customer-facing labels.
export const ORDER_STATES: Record<string, { label: string; tone: Tone }> = {
  Open: { label: "Pending", tone: "info" },
  Confirmed: { label: "Processing", tone: "info" },
  Complete: { label: "Complete", tone: "success" },
  Cancelled: { label: "Cancelled", tone: "danger" },
};

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export const orderReference = (order: Pick<Order, "orderNumber" | "id">) => order.orderNumber ?? order.id.slice(0, 8).toUpperCase();
