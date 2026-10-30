import { describe, expect, it } from "vitest";
import type { BuyerContext } from "@/features/business-units/types";
import { priceSelection, pricingKey, pricingKeyId } from "@/features/catalog/pricing";

// A signed-in buyer's full context: unit, addresses and permissions next to the pricing fields.
const buyer = (over: Partial<BuyerContext> = {}): BuyerContext => ({
  businessUnitKey: "lifttech-solutions-ltd-es",
  businessUnitName: "LiftTech Soluciones S.L.",
  unitType: "Division",
  parentKey: "lifttech-solutions-ltd",
  storeKey: "spain",
  storeName: "Spain",
  channelId: "channel-spain",
  channelKey: "spain",
  currency: "EUR",
  country: "ES",
  addresses: [{ id: "a1", country: "ES", city: "Madrid" }],
  canOrder: true,
  permissions: ["CreateMyCarts", "ViewMyOrders"],
  ...over,
});

describe("pricingKey", () => {
  it("keeps only the pricing fields of a buying context", () => {
    expect(pricingKey(buyer())).toEqual({ storeKey: "spain", channelId: "channel-spain", currency: "EUR", country: "ES" });
  });

  it("carries nothing about the person or the unit", () => {
    const key = pricingKey(buyer({ customerGroupId: undefined }));
    for (const field of ["businessUnitKey", "businessUnitName", "addresses", "permissions", "canOrder", "guest", "consumer"])
      expect(key).not.toHaveProperty(field);
  });

  it("gives colleagues and different units of one store the same key", () => {
    const colleague = buyer({ permissions: ["UpdateApprovalFlows"], canOrder: false });
    const otherUnit = buyer({ businessUnitKey: "other-es", businessUnitName: "Other S.L.", addresses: [] });
    expect(pricingKey(colleague)).toEqual(pricingKey(buyer()));
    expect(pricingKeyId(pricingKey(otherUnit))).toBe(pricingKeyId(pricingKey(buyer())));
  });

  it("drops empty optional fields, so a missing country and an empty one match", () => {
    const guest = { storeKey: "default-store", channelId: "b2c", currency: "EUR" };
    expect(pricingKey({ ...guest, country: "", customerGroupId: undefined })).toEqual(guest);
  });

  it("separates a customer group from the public prices of the same store", () => {
    const publicKey = pricingKey({ storeKey: "default-store", channelId: "b2c", currency: "EUR" });
    const trade = pricingKey({ ...publicKey, customerGroupId: "trade-members" });
    expect(pricingKeyId(trade)).not.toBe(pricingKeyId(publicKey));
  });
});

describe("priceSelection", () => {
  it("sends the store, channel, currency and country", () => {
    expect(priceSelection(pricingKey(buyer()))).toEqual({
      storeProjection: "spain",
      priceCurrency: "EUR",
      priceChannel: "channel-spain",
      priceCountry: "ES",
    });
  });

  it("adds the customer group when there is one", () => {
    expect(priceSelection({ storeKey: "default-store", channelId: "b2c", currency: "EUR", customerGroupId: "g1" })).toMatchObject({
      priceCustomerGroup: "g1",
    });
  });
});
