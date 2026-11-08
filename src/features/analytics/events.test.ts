import { describe, expect, it } from "vitest";
import {
  analyticsItem,
  ecommerceEvent,
  gtmId,
  itemListEvent,
  MAX_ITEMS,
  parseConsent,
  parseSent,
  purchaseEvent,
  rememberSent,
  scrub,
  searchEvent,
  SENT_MAX,
  shouldTrackPurchase,
} from "./events";

const eur = (centAmount: number) => ({ centAmount, fractionDigits: 2, currencyCode: "EUR" });

describe("analyticsItem", () => {
  it("maps price, quantity and optional fields", () => {
    expect(analyticsItem({ sku: "air-filter", name: "Air filter", price: eur(7500), quantity: 3, category: "Spare parts" }, 2)).toEqual({
      item_id: "air-filter",
      item_name: "Air filter",
      price: 75,
      quantity: 3,
      item_category: "Spare parts",
      index: 2,
    });
  });

  it("honours fraction digits and floors bad quantities to 1", () => {
    const item = analyticsItem({ sku: "x", name: "X", price: { centAmount: 12345, fractionDigits: 3, currencyCode: "KWD" }, quantity: 0 });
    expect(item.price).toBe(12.345);
    expect(item.quantity).toBe(1);
  });
});

describe("scrub", () => {
  it("cuts out email addresses and caps the length", () => {
    expect(scrub("Ask jane.doe@example.com today")).toBe("Ask [redacted] today");
    expect(scrub("a".repeat(150))).toHaveLength(100);
  });
});

describe("ecommerceEvent", () => {
  it("sums value in the first currency and skips other currencies", () => {
    const event = ecommerceEvent("view_cart", [
      { sku: "a", name: "A", price: eur(1010), quantity: 3 },
      { sku: "b", name: "B", price: { centAmount: 500, fractionDigits: 2, currencyCode: "USD" } },
      { sku: "c", name: "C" },
    ]);
    expect(event.ecommerce.currency).toBe("EUR");
    expect(event.ecommerce.value).toBe(30.3);
    expect(event.ecommerce.items).toHaveLength(3);
  });

  it("has no currency or value without prices", () => {
    const event = ecommerceEvent("add_to_cart", [{ sku: "a", name: "A" }]);
    expect(event.ecommerce).toEqual({ items: [{ item_id: "a", item_name: "A", quantity: 1 }] });
  });

  it("caps the item count", () => {
    const items = Array.from({ length: 150 }, (_, i) => ({ sku: `s${i}`, name: "N" }));
    expect(ecommerceEvent("view_cart", items).ecommerce.items).toHaveLength(MAX_ITEMS);
  });
});

describe("itemListEvent", () => {
  it("numbers items from the page offset and has no value", () => {
    const event = itemListEvent(
      "spare-parts",
      "Spare parts",
      [
        { sku: "a", name: "A", price: eur(100) },
        { sku: "b", name: "B" },
      ],
      24,
    );
    expect(event.ecommerce.value).toBeUndefined();
    expect(event.ecommerce.currency).toBe("EUR");
    expect(event.ecommerce.items.map((i) => i.index)).toEqual([24, 25]);
    expect(event.ecommerce.items[0].item_list_id).toBe("spare-parts");
  });
});

describe("purchaseEvent", () => {
  it("prefers the order number and adds tax and shipping", () => {
    const event = purchaseEvent({
      id: "uuid",
      orderNumber: "FL-1001",
      total: eur(12000),
      tax: eur(2000),
      shipping: eur(0),
      items: [{ sku: "a", name: "A", price: eur(10000), quantity: 1 }],
    });
    expect(event.ecommerce).toMatchObject({ transaction_id: "FL-1001", currency: "EUR", value: 120, tax: 20, shipping: 0 });
  });

  it("falls back to the id", () => {
    expect(purchaseEvent({ id: "uuid", total: eur(1), items: [] }).ecommerce.transaction_id).toBe("uuid");
  });
});

describe("searchEvent", () => {
  it("masks emails and long digit runs but keeps SKU-like terms", () => {
    expect(searchEvent(" me@x.io ", 3).search_term).toBe("[redacted]");
    expect(searchEvent("call +49 170 1234567", 0).search_term).toBe("call +[redacted]");
    expect(searchEvent("JJ234-WX 2021", 2).search_term).toBe("JJ234-WX 2021");
  });
});

describe("shouldTrackPurchase", () => {
  const now = Date.parse("2026-11-08T12:00:00Z");
  it("tracks a new order once", () => {
    expect(shouldTrackPurchase("o1", "2026-11-08T11:58:00Z", now, [])).toBe(true);
    expect(shouldTrackPurchase("o1", "2026-11-08T11:58:00Z", now, ["o1"])).toBe(false);
  });
  it("skips old orders and bad dates", () => {
    expect(shouldTrackPurchase("o1", "2026-11-08T10:00:00Z", now, [])).toBe(false);
    expect(shouldTrackPurchase("o1", "nonsense", now, [])).toBe(false);
  });
});

describe("sent ids", () => {
  it("parses defensively and keeps the newest", () => {
    expect(parseSent("not json")).toEqual([]);
    expect(parseSent('{"a":1}')).toEqual([]);
    expect(parseSent('["a",2,"b"]')).toEqual(["a", "b"]);
    const many = Array.from({ length: 30 }, (_, i) => `o${i}`);
    expect(rememberSent(many, "new")).toHaveLength(SENT_MAX);
    expect(rememberSent(["a", "b"], "a")).toEqual(["b", "a"]);
  });
});

describe("consent and container id", () => {
  it("accepts only known values", () => {
    expect(parseConsent("granted")).toBe("granted");
    expect(parseConsent("yes")).toBeUndefined();
    expect(gtmId("GTM-ABC123")).toBe("GTM-ABC123");
    expect(gtmId('GTM-ABC"><script>')).toBeUndefined();
    expect(gtmId(undefined)).toBeUndefined();
  });
});
