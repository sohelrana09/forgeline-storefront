// What a price-selected catalog read depends on: the store, its distribution channel, currency, country and (B2C) the
// customer group. Nothing about the person: every buyer of a unit, or every guest, shares one key, so catalog reads
// keyed by it can be cached and shared (E29) without any session data reaching the cache.
export type PricingKey = {
  storeKey: string;
  channelId: string;
  currency: string;
  country?: string;
  customerGroupId?: string;
};

// Copies only the pricing fields of a buying context (which also carries the unit, addresses and permissions), and
// drops empty optional ones, so equal pricing always gives an equal key.
export function pricingKey(ctx: PricingKey): PricingKey {
  return {
    storeKey: ctx.storeKey,
    channelId: ctx.channelId,
    currency: ctx.currency,
    ...(ctx.country && { country: ctx.country }),
    ...(ctx.customerGroupId && { customerGroupId: ctx.customerGroupId }),
  };
}

// The key as one string, for in-process memos.
export const pricingKeyId = (key: PricingKey) =>
  [key.storeKey, key.channelId, key.currency, key.country ?? "", key.customerGroupId ?? ""].join(":");

// Query arguments for productProjections(): the store's assortment and the price for the key.
export const priceSelection = (key: PricingKey) => ({
  storeProjection: key.storeKey,
  priceCurrency: key.currency,
  priceChannel: key.channelId,
  ...(key.country && { priceCountry: key.country }),
  // B2C customer groups (e.g. trade members): their own rows win, other SKUs fall back to the public price.
  ...(key.customerGroupId && { priceCustomerGroup: key.customerGroupId }),
});
