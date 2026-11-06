// Stock at order time (G6). Carts are created with inventoryMode ReserveOnOrder in stores that have a supply channel,
// and every line names that channel, so commercetools checks and reserves the channel's stock when the order is created
// and refuses it with OutOfStock when a line can't be filled. Pure, unit-tested.

type ErrorBody = { body?: { errors?: { code?: string; skus?: unknown }[] } };

// The SKUs commercetools reported out of stock, or undefined when the error is something else.
export function outOfStockSkus(err: unknown): string[] | undefined {
  const errors = (err as ErrorBody)?.body?.errors ?? [];
  const stock = errors.filter((e) => e.code === "OutOfStock");
  if (stock.length === 0) return undefined;
  const skus = stock.flatMap((e) => (Array.isArray(e.skus) ? e.skus.filter((s): s is string => typeof s === "string") : []));
  return [...new Set(skus)];
}

export function outOfStockMessage(skus: string[]): string {
  if (skus.length === 0) return "Some items in your cart are no longer in stock. Please review your cart.";
  const list = skus.slice(0, 5).join(", ") + (skus.length > 5 ? ` and ${skus.length - 5} more` : "");
  return `Not enough stock for ${list}. Lower the quantity or remove ${skus.length === 1 ? "it" : "them"} from your cart, then try again.`;
}

type StockLine = { sku: string; channel: string; quantity: number };
type StockEntry = { sku: string; supplyChannel?: { id: string }; availableQuantity: number };

// SKUs the cart wants more of than the channel has, lines of one SKU counted together. A SKU without a stock entry is
// left to commercetools, which decides when the order is created.
export function shortfalls(lines: StockLine[], entries: StockEntry[]): string[] {
  const wanted = new Map<string, StockLine>();
  for (const line of lines) {
    const key = `${line.channel}|${line.sku}`;
    wanted.set(key, { ...line, quantity: (wanted.get(key)?.quantity ?? 0) + line.quantity });
  }
  return [...wanted.values()]
    .filter((line) => {
      const entry = entries.find((e) => e.sku === line.sku && e.supplyChannel?.id === line.channel);
      return entry !== undefined && entry.availableQuantity < line.quantity;
    })
    .map((line) => line.sku);
}

// The buyer-facing message for an out-of-stock order error, or undefined for any other error.
export function stockErrorMessage(err: unknown): string | undefined {
  const skus = outOfStockSkus(err);
  return skus && outOfStockMessage(skus);
}
