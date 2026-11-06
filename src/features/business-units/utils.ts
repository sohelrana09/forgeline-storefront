import type { BuyerContext, BuyingContext } from "@/features/business-units/types";

// May this associate order from a cart? From what their roles allow, not from a role's name: a seller can call roles
// anything, and commercetools itself decides by this permission when the order is created.
export const ORDER_PERMISSION = "CreateMyOrdersFromMyCarts";

// Business units where this customer is an associate (explicit or inherited), with their permissions. Pure, unit-tested.
export function contextsFor(all: BuyingContext[], customerId: string): BuyerContext[] {
  return all.flatMap(({ members, ...c }) => {
    // A customer can be listed twice (explicit + inherited): merge their permissions.
    const self = members.filter((m) => m.customerId === customerId);
    if (self.length === 0) return [];
    const permissions = [...new Set(self.flatMap((m) => m.permissions))];
    return [{ ...c, canOrder: permissions.includes(ORDER_PERMISSION), permissions }];
  });
}

export const pickContext = (contexts: BuyerContext[], selectedKey: string | undefined) =>
  contexts.find((c) => c.businessUnitKey === selectedKey) ?? contexts[0];
