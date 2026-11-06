// Order numbers (G4): `<PREFIX>-<year>-<000123>`, one counter per prefix and year in a Custom Object
// (container `order-number`, key `<PREFIX>-<year>`, value `{ next }`). Pure, unit-tested; the writes are in service.ts.
// Numbers are unique (commercetools rejects a duplicate orderNumber) and increasing, but not gapless: a number taken
// from the counter by a worker that then loses the race for the order is skipped.

export const DEFAULT_ORDER_PREFIX = "ORD";
export const ORDER_NUMBER_CONTAINER = "order-number";

// ORDER_NUMBER_PREFIX: 1 to 8 capital letters or digits; anything else falls back to the default.
export function orderNumberPrefix(value: string | undefined = process.env.ORDER_NUMBER_PREFIX): string {
  const prefix = value?.trim().toUpperCase();
  return prefix && /^[A-Z0-9]{1,8}$/.test(prefix) ? prefix : DEFAULT_ORDER_PREFIX;
}

export const counterKey = (prefix: string, year: number) => `${prefix}-${year}`;

export const formatOrderNumber = (prefix: string, year: number, n: number) => `${prefix}-${year}-${String(n).padStart(6, "0")}`;

// The number the counter hands out next: its stored `next`, or 1 for a new or unreadable counter.
export function counterNext(value: unknown): number {
  const next = (value as { next?: unknown } | undefined)?.next;
  return typeof next === "number" && Number.isSafeInteger(next) && next > 0 ? next : 1;
}
