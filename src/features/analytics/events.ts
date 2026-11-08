// Analytics data layer (docs/features/analytics-datalayer.md), pure and unit-tested. Events follow Google Analytics 4's
// recommended e-commerce schema (view_item_list, view_item, add_to_cart, view_cart, begin_checkout, purchase, search),
// which Google Tag Manager, Segment, Piwik PRO and most tag managers read from `window.dataLayer`.
// Nothing about the person goes in: no email, name, customer id, address or company. Prices are what the visitor saw
// (company prices included), so a business buyer's events carry their contract price; that is the point of B2B
// analytics, and it stays in the visitor's own browser until they consent to a tag manager.

export type Money = { centAmount: number; fractionDigits: number; currencyCode: string };

export type ItemInput = {
  sku: string;
  name: string;
  price?: Money;
  quantity?: number;
  category?: string;
  variant?: string;
};

export type AnalyticsItem = {
  item_id: string;
  item_name: string;
  price?: number;
  quantity: number;
  item_category?: string;
  item_variant?: string;
  index?: number;
  item_list_id?: string;
  item_list_name?: string;
};

export type EcommerceEvent = {
  event: "view_item_list" | "view_item" | "add_to_cart" | "remove_from_cart" | "view_cart" | "begin_checkout" | "purchase";
  ecommerce: {
    currency?: string;
    value?: number;
    transaction_id?: string;
    tax?: number;
    shipping?: number;
    item_list_id?: string;
    item_list_name?: string;
    items: AnalyticsItem[];
  };
};

export type SearchEvent = { event: "search"; search_term: string; results: number };
export type DataLayerEvent = EcommerceEvent | SearchEvent;

// Items per event: GA4 accepts 200, tag managers choke on more, and a list page shows at most 96.
export const MAX_ITEMS = 100;

const amount = (m: Money) => Math.round(m.centAmount) / 10 ** m.fractionDigits;
// Two decimals at most, without float noise (0.1 + 0.2).
const round = (n: number) => Math.round(n * 100) / 100;

// Email addresses must never reach an analytics tool (Google's terms forbid it, and it's personal data). Product data
// can contain anything a merchant typed, so anything that looks like one is cut out of every text we send.
const EMAIL = /[^\s@<>"']+@[^\s@<>"']+\.[a-z]{2,}/gi;
export const scrub = (text: string) => text.replace(EMAIL, "[redacted]").slice(0, 100);

export function analyticsItem(input: ItemInput, index?: number): AnalyticsItem {
  return {
    item_id: scrub(input.sku),
    item_name: scrub(input.name),
    ...(input.price && { price: amount(input.price) }),
    quantity: Math.max(1, Math.floor(input.quantity ?? 1)),
    ...(input.category && { item_category: scrub(input.category) }),
    ...(input.variant && { item_variant: scrub(input.variant) }),
    ...(index !== undefined && { index }),
  };
}

// Value and currency from the items: the sum of price × quantity in the first priced item's currency. Items in another
// currency (never in one cart, but a list could mix) are left out of the value.
function totals(items: ItemInput[]): { currency?: string; value?: number } {
  const currency = items.find((i) => i.price)?.price?.currencyCode;
  if (!currency) return {};
  const value = items.reduce(
    (sum, i) => (i.price?.currencyCode === currency ? sum + amount(i.price) * Math.max(1, i.quantity ?? 1) : sum),
    0,
  );
  return { currency, value: round(value) };
}

export function ecommerceEvent(event: Exclude<EcommerceEvent["event"], "view_item_list" | "purchase">, items: ItemInput[]): EcommerceEvent {
  const shown = items.slice(0, MAX_ITEMS);
  return { event, ecommerce: { ...totals(shown), items: shown.map((i) => analyticsItem(i)) } };
}

// A product list (category, search, carousel): positions start at 0 on the page, so page 2 continues the count.
export function itemListEvent(listId: string, listName: string, items: ItemInput[], offset = 0): EcommerceEvent {
  const shown = items.slice(0, MAX_ITEMS);
  // A list has no value (nothing was chosen), only the currency of its prices.
  const { currency } = totals(shown);
  return {
    event: "view_item_list",
    ecommerce: {
      ...(currency && { currency }),
      item_list_id: scrub(listId),
      item_list_name: scrub(listName),
      items: shown.map((i, n) => ({ ...analyticsItem(i, offset + n), item_list_id: scrub(listId), item_list_name: scrub(listName) })),
    },
  };
}

export type OrderInput = {
  id: string;
  orderNumber?: string;
  total: Money;
  tax?: Money;
  shipping?: Money;
  items: ItemInput[];
};

// The order number when there is one (what the merchant sees in Merchant Center and the ERP), else the id.
export function purchaseEvent(order: OrderInput): EcommerceEvent {
  return {
    event: "purchase",
    ecommerce: {
      transaction_id: scrub(order.orderNumber || order.id),
      currency: order.total.currencyCode,
      value: amount(order.total),
      ...(order.tax && { tax: amount(order.tax) }),
      ...(order.shipping && { shipping: amount(order.shipping) }),
      items: order.items.slice(0, MAX_ITEMS).map((i) => analyticsItem(i)),
    },
  };
}

// A search term can be anything a visitor typed, including their own email or phone number: emails are cut out and
// long digit runs (phone, card, account numbers) masked. SKUs keep their short digit groups.
export function searchEvent(term: string, results: number): SearchEvent {
  const cleaned = scrub(term.trim()).replace(/\d[\d\s-]{7,}\d/g, "[redacted]");
  return { event: "search", search_term: cleaned, results: Math.max(0, Math.floor(results)) };
}

// A purchase is sent once per order and browser: only while the order is new (the redirect after checkout lands there
// right away), and never again for an id this browser already sent (a reload, the back button).
export function shouldTrackPurchase(
  id: string,
  createdAt: string,
  now: number,
  sent: readonly string[],
  windowMs = 30 * 60 * 1000,
): boolean {
  const created = Date.parse(createdAt);
  return Number.isFinite(created) && now - created >= -60_000 && now - created <= windowMs && !sent.includes(id);
}

// The ids this browser sent, newest last, kept short.
export const SENT_MAX = 20;
export function parseSent(raw: string | null | undefined): string[] {
  try {
    const value: unknown = JSON.parse(raw ?? "[]");
    return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string").slice(-SENT_MAX) : [];
  } catch {
    return [];
  }
}
export const rememberSent = (sent: readonly string[], id: string) => [...sent.filter((s) => s !== id), id].slice(-SENT_MAX);

// ---------- Consent and the tag manager ----------

export type Consent = "granted" | "denied";
export const CONSENT_KEY = "analytics-consent";
export const parseConsent = (raw: string | null | undefined): Consent | undefined =>
  raw === "granted" || raw === "denied" ? raw : undefined;

// A Google Tag Manager container id, or undefined: it goes into a script URL, so nothing but the documented shape.
export const gtmId = (value: string | undefined): string | undefined => (value && /^GTM-[A-Z0-9]{4,12}$/.test(value) ? value : undefined);
