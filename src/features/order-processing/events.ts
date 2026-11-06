// What a commercetools Subscription message delivered to /api/order-events is about. Pure, unit-tested.
// Accepts the message plain, wrapped in EventBridge's `{ detail }`, or in a Pub/Sub push `{ message: { data } }`
// (base64 JSON). Only the resource reference is used: the order is always re-read from commercetools.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export type OrderEventTarget = { typeId: "order" | "payment"; id: string };

export function orderEventTarget(body: unknown, depth = 0): OrderEventTarget | undefined {
  if (!body || typeof body !== "object" || depth > 2) return undefined;
  const b = body as { detail?: unknown; message?: { data?: unknown }; resource?: { typeId?: unknown; id?: unknown } };
  if (b.detail) return orderEventTarget(b.detail, depth + 1);
  if (typeof b.message?.data === "string") {
    try {
      return orderEventTarget(JSON.parse(Buffer.from(b.message.data, "base64").toString("utf8")), depth + 1);
    } catch {
      return undefined;
    }
  }
  const { typeId, id } = b.resource ?? {};
  if ((typeId === "order" || typeId === "payment") && typeof id === "string" && UUID.test(id)) return { typeId, id };
  return undefined;
}
