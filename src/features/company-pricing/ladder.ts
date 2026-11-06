// Company price ladders (pure): parse the price store's hash, pick the tier for a quantity, and turn decimal prices
// into commercetools money (cent precision, or high precision for SAP's 3 to 6 decimal unit prices).
import type { Price, TypedMoney, TypedMoneyDraft } from "@commercetools/platform-sdk";
import type { Ladder, LadderFields } from "@/features/company-pricing/types";

const DECIMAL = /^(\d*)\.?(\d*)$/;
const MAX_DIGITS = 10; // more than SAP sends; commercetools accepts up to 20

// "0012.50" → "12.5", ".386559" → "0.386559"; undefined for anything that isn't a non-negative decimal.
export function normalizePrice(raw: unknown): string | undefined {
  const text = String(raw ?? "").trim();
  const m = DECIMAL.exec(text);
  if (!m || (!m[1] && !m[2])) return undefined;
  const units = m[1].replace(/^0+(?=\d)/, "") || "0";
  const fraction = m[2].replace(/0+$/, "");
  if (fraction.length > MAX_DIGITS) return undefined;
  return fraction ? `${units}.${fraction}` : units;
}

// The hash's fields as a ladder, lowest quantity first. Empty or unreadable prices are skipped (the source data has
// a few `"p": ""`), so a SKU without a usable base price has no ladder and falls back to the web price.
export function parseLadder(fields: LadderFields | null | undefined): Ladder | undefined {
  if (!fields) return undefined;
  const steps: Ladder = [];
  for (const [field, raw] of Object.entries(fields)) {
    let value: unknown = raw;
    if (typeof raw === "string") {
      try {
        value = JSON.parse(raw);
      } catch {
        continue;
      }
    }
    const price = normalizePrice((value as { p?: unknown } | null)?.p);
    const qty = field === "" ? 1 : Number(normalizePrice(field));
    if (price === undefined || !Number.isInteger(qty) || qty < 1) continue;
    steps.push({ minQuantity: qty, price });
  }
  steps.sort((a, b) => a.minQuantity - b.minQuantity);
  return steps[0]?.minQuantity === 1 ? steps : undefined;
}

// The unit price for a quantity: the highest break the quantity reaches.
export function priceFor(ladder: Ladder, quantity: number): string {
  return ladder.findLast((s) => quantity >= s.minQuantity)?.price ?? ladder[0].price;
}

const decimals = (price: string) => price.split(".")[1]?.length ?? 0;

// Whole minor units at `digits` decimals, without floating point ("0.386559", 6 → 386559).
function scaled(price: string, digits: number): number {
  const [units, fraction = ""] = price.split(".");
  return Number(units + fraction.padEnd(digits, "0").slice(0, digits));
}

// Rounds half up from `from` decimals to `to` decimals (to < from).
const roundTo = (amount: number, from: number, to: number) => Math.round(amount / 10 ** (from - to));

// Money for the cart (externalPrice): cent precision when the currency's decimals are enough, else high precision.
export function toMoneyDraft(price: string, currencyCode: string, currencyDigits = 2): TypedMoneyDraft {
  const digits = decimals(price);
  if (digits <= currencyDigits) return { type: "centPrecision", currencyCode, centAmount: scaled(price, currencyDigits) };
  return { type: "highPrecision", currencyCode, preciseAmount: scaled(price, digits), fractionDigits: digits };
}

// The same money as commercetools returns it: high precision keeps `centAmount` rounded to the currency's decimals.
export function toTypedMoney(price: string, currencyCode: string, currencyDigits = 2): TypedMoney {
  const digits = decimals(price);
  if (digits <= currencyDigits)
    return { type: "centPrecision", currencyCode, centAmount: scaled(price, currencyDigits), fractionDigits: currencyDigits };
  const preciseAmount = scaled(price, digits);
  return {
    type: "highPrecision",
    currencyCode,
    preciseAmount,
    fractionDigits: digits,
    centAmount: roundTo(preciseAmount, digits, currencyDigits),
  };
}

// The ladder as a commercetools Price (base value + tiers), so product pages, cards, tiers and quick order show the
// company price with the code that shows standalone prices.
export function toPrice(ladder: Ladder, currencyCode: string): Price {
  return {
    id: "company-price",
    value: toTypedMoney(ladder[0].price, currencyCode),
    tiers: ladder.slice(1).map((s) => ({ minimumQuantity: s.minQuantity, value: toTypedMoney(s.price, currencyCode) })),
  };
}

// Whether a line's current price already is this money (so the extension sends no update).
export function sameMoney(a: TypedMoney, b: TypedMoneyDraft): boolean {
  if (a.currencyCode !== b.currencyCode) return false;
  if (b.type === "highPrecision")
    return a.type === "highPrecision" && a.preciseAmount === b.preciseAmount && a.fractionDigits === b.fractionDigits;
  return a.type !== "highPrecision" && a.centAmount === b.centAmount;
}
