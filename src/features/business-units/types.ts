import type { Address, BusinessUnit, Permission } from "@commercetools/platform-sdk";

export type BuyingContext = {
  businessUnitKey: string;
  businessUnitName: string;
  unitType: BusinessUnit["unitType"];
  parentKey?: string;
  storeKey: string;
  storeName: string;
  channelId: string;
  channelKey?: string;
  supplyChannelId?: string;
  currency: string;
  country?: string;
  // A consumer's customer group (B2C group prices); business units price by their store's channel instead.
  customerGroupId?: string;
  // The unit's addresses; carts start with the defaults so tax and shipping show from the first line.
  addresses: Address[];
  defaultShippingAddress?: Address;
  defaultBillingAddress?: Address;
  // Explicit + inherited associates, their role keys and the permissions those roles grant (server-side only).
  members: { customerId: string; roles: string[]; permissions: Permission[] }[];
};

// What pricing and carts need; membership stays server-side.
export type PricingContext = Omit<BuyingContext, "members">;

// The selected unit for the signed-in customer, plus whether they hold the buyer role there.
// `permissions` drive what the UI offers (company admin features); actions re-check them live (hasPermissionNow).
// Without a business unit (empty key, priced from the B2C store): guests (guest: true) and signed-in consumers,
// i.e. customers who aren't an associate of any unit (consumer: true; own addresses, no quotes or company).
export type BuyerContext = PricingContext & {
  canOrder: boolean;
  permissions: Permission[];
  guest?: boolean;
  consumer?: boolean;
};
