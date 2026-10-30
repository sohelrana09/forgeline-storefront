import "server-only";
import type { BusinessUnit, Permission } from "@commercetools/platform-sdk";
import { cache } from "react";
import { apiRoot } from "@/lib/commercetools/client";
import { staleWhileRevalidate } from "@/lib/memo";
import { cacheFor, TAGS } from "@/lib/cache";
import { B2C_STORE_KEY } from "@/lib/commercetools/stores";
import { str } from "@/lib/predicate";

// Sample-data stores have no countries set, so pick the currency/country their prices use.
// spain and us-* prices are country-restricted (ES / US) and only match when the country is sent.
const STORE_PRICING: Record<string, { currency: string; country?: string }> = {
  "de-fr-uk": { currency: "EUR" },
  spain: { currency: "EUR", country: "ES" },
  "us-medium-customers": { currency: "USD", country: "US" },
  "us-large-customers": { currency: "USD", country: "US" },
};

export type { BuyingContext, PricingContext, BuyerContext } from "@/features/business-units/types";
import type { BuyerContext, BuyingContext } from "@/features/business-units/types";

// Divisions with storeMode/associateMode FromParent expose stores/associates only as inherited*.
function effectiveStoreKey(bu: BusinessUnit): string | undefined {
  const stores = bu.storeMode === "FromParent" ? bu.inheritedStores : bu.stores;
  return stores?.[0]?.key;
}

// Every business unit, page by page (the sample data has 6; a real B2B project has thousands).
async function allBusinessUnits(): Promise<{ results: BusinessUnit[] }> {
  const results: BusinessUnit[] = [];
  for (let offset = 0; ; offset += 500) {
    const { body } = await apiRoot
      .businessUnits()
      .get({ queryArgs: { limit: 500, offset, sort: ["key asc"], withTotal: false } })
      .execute();
    results.push(...body.results);
    if (body.results.length < 500) return { results };
  }
}

async function loadBuyingContexts(): Promise<BuyingContext[]> {
  const [units, { body: stores }, { body: roles }] = await Promise.all([
    allBusinessUnits(),
    apiRoot
      .stores()
      .get({ queryArgs: { limit: 100, expand: ["distributionChannels[*]"] } })
      .execute(),
    apiRoot
      .associateRoles()
      .get({ queryArgs: { limit: 100 } })
      .execute(),
  ]);
  const rolePermissions = new Map(roles.results.map((r) => [r.key, r.permissions]));

  // Company first, then its divisions, grouped by top-level company.
  const ordered = [...units.results].sort(
    (a, b) =>
      a.topLevelUnit.key.localeCompare(b.topLevelUnit.key) ||
      Number(a.unitType === "Division") - Number(b.unitType === "Division") ||
      a.name.localeCompare(b.name),
  );

  const contexts: BuyingContext[] = [];
  for (const bu of ordered) {
    const storeKey = effectiveStoreKey(bu);
    const store = stores.results.find((s) => s.key === storeKey);
    const channel = store?.distributionChannels[0];
    if (!store || !channel) continue; // can't price anything without a store channel

    const pricing = STORE_PRICING[store.key] ?? { currency: "EUR" };
    const byId = (id?: string) => bu.addresses.find((a) => a.id === id);
    contexts.push({
      businessUnitKey: bu.key,
      businessUnitName: bu.name,
      unitType: bu.unitType,
      parentKey: bu.parentUnit?.key,
      storeKey: store.key,
      storeName: store.name?.["en-US"] ?? store.key,
      channelId: channel.id,
      channelKey: channel.obj?.key,
      supplyChannelId: store.supplyChannels?.[0]?.id,
      ...pricing,
      addresses: bu.addresses,
      defaultShippingAddress: byId(bu.defaultShippingAddressId) ?? bu.addresses[0],
      defaultBillingAddress: byId(bu.defaultBillingAddressId) ?? byId(bu.defaultShippingAddressId) ?? bu.addresses[0],
      members: [...bu.associates, ...(bu.inheritedAssociates ?? [])].map((a) => {
        const roleKeys = a.associateRoleAssignments.map((r) => r.associateRole.key);
        return {
          customerId: a.customer.id,
          roles: roleKeys,
          permissions: [...new Set(roleKeys.flatMap((k) => rolePermissions.get(k) ?? []))],
        };
      }),
    });
  }
  return contexts;
}

// Guests and consumers (customers without a company) shop the default store at its list prices (EUR, VAT
// included). Signing in as a business buyer re-prices for their company.
export const GUEST_STORE_KEY = B2C_STORE_KEY;
// Countries consumers can ship to: the "europe" shipping zone (Standard and Premium shipping in EUR).
export const CONSUMER_COUNTRIES = ["DE", "ES", "FR", "GB"];

async function loadGuestContext(): Promise<BuyerContext> {
  "use cache: remote";
  cacheFor("structure", TAGS.units);
  const { body: store } = await apiRoot
    .stores()
    .withKey({ key: GUEST_STORE_KEY })
    .get({ queryArgs: { expand: ["distributionChannels[*]"] } })
    .execute();
  const channel = store.distributionChannels[0];
  if (!channel) throw new Error(`Store ${GUEST_STORE_KEY} has no distribution channel`);
  return {
    guest: true,
    canOrder: true, // guests may fill a cart; checkout and quotes ask them to sign in
    permissions: [],
    businessUnitKey: "",
    businessUnitName: "Guest",
    unitType: "Company",
    storeKey: store.key,
    storeName: store.name?.["en-US"] ?? store.key,
    channelId: channel.id,
    channelKey: channel.obj?.key,
    supplyChannelId: store.supplyChannels?.[0]?.id,
    ...(STORE_PRICING[store.key] ?? { currency: "EUR" }),
    addresses: [],
  };
}

// Is this customer an associate of any unit (directly or inherited)? Asked before treating someone as a consumer,
// so a new associate or a unit missing from the 5-minute memo never turns a business buyer into a consumer.
// Cached for 60 seconds per customer, since every consumer page asks.
const associateMemo = staleWhileRevalidate<boolean>(60 * 1000);
export const isAssociateNow = (customerId: string) => associateMemo(customerId, () => queryIsAssociate(customerId));

async function queryIsAssociate(customerId: string): Promise<boolean> {
  const id = str(customerId);
  const { body } = await apiRoot
    .businessUnits()
    .get({
      queryArgs: {
        where: `associates(customer(id=${id})) or inheritedAssociates(customer(id=${id}))`,
        limit: 1,
        withTotal: false,
      },
    })
    .execute();
  return body.results.length > 0;
}

// The unit and the project's associate roles as they are now: read once per page render (React cache), so a page
// that checks several permissions and lists members makes one call each instead of one per check. Outside a render
// (Server Actions, Route Handlers) React's cache is off and every call reads live, which writes rely on.
export const businessUnitNow = cache(async (key: string) => (await apiRoot.businessUnits().withKey({ key }).get().execute()).body);
export const associateRolesNow = cache(
  async () =>
    (
      await apiRoot
        .associateRoles()
        .get({ queryArgs: { limit: 100 } })
        .execute()
    ).body.results,
);

// Order-critical paths (delivery, place order) must not trust the 5-minute memo: a revoked buyer role
// or removed associate takes effect immediately here.
export async function hasBuyerRoleNow(businessUnitKey: string, customerId: string): Promise<boolean> {
  const bu = await businessUnitNow(businessUnitKey);
  return [...bu.associates, ...(bu.inheritedAssociates ?? [])].some(
    (a) => a.customer.id === customerId && a.associateRoleAssignments.some((r) => r.associateRole.key === "buyer"),
  );
}

// Live check of one associate-role permission (e.g. "RenegotiateMyQuotes"). Required wherever the admin client
// acts for the buyer, because then commercetools doesn't check the associate's permissions itself.
export async function hasPermissionNow(businessUnitKey: string, customerId: string, permission: Permission): Promise<boolean> {
  return (await permissionsNow(businessUnitKey, customerId)).has(permission);
}

// Every permission the customer holds in the unit right now (explicit + inherited roles), for checks that need several.
export async function permissionsNow(businessUnitKey: string, customerId: string): Promise<Set<Permission>> {
  const [bu, roles] = await Promise.all([businessUnitNow(businessUnitKey), associateRolesNow()]);
  const roleKeys = new Set(
    [...bu.associates, ...(bu.inheritedAssociates ?? [])]
      .filter((a) => a.customer.id === customerId)
      .flatMap((a) => a.associateRoleAssignments.map((r) => r.associateRole.key)),
  );
  return new Set(roles.filter((role) => roleKeys.has(role.key)).flatMap((role) => role.permissions));
}

// Business units, stores and channels change rarely: refresh them every 5 minutes in the background, so no
// request waits for the reload. Order-critical paths re-check membership live (hasBuyerRoleNow, hasPermissionNow);
// elsewhere a membership change (new associate, removed buyer) can take up to ~5 minutes to show. Cart writes
// are still enforced by commercetools on the customer token.
const memo = staleWhileRevalidate<BuyingContext[]>(5 * 60 * 1000);

export const getBuyingContexts = () => memo("contexts", loadBuyingContexts);
// Call after changing associates or unit details, so the change shows on the next request (not in 5 minutes).
export const forgetBuyingContexts = () => memo.forget("contexts");
// The guest context is the same for every visitor: cached and shared, refreshed hourly or when units change.
export const getGuestContext = () => loadGuestContext();
// A signed-in consumer: the B2C store's prices (their customer group's where it has its own), a cart and orders of
// their own, no business unit.
export const getConsumerContext = async (customerId: string): Promise<BuyerContext> => {
  const [guest, customerGroupId] = await Promise.all([getGuestContext(), customerGroupNow(customerId)]);
  return { ...guest, guest: false, consumer: true, businessUnitName: "Personal account", customerGroupId };
};

// The customer's group, set by the seller (Merchant Center or an ERP sync). Cached for 60 seconds per customer, like
// isAssociateNow, so a change shows within a minute without a /me call on every page.
const groupMemo = staleWhileRevalidate<string | undefined>(60 * 1000);
const customerGroupNow = (customerId: string) =>
  groupMemo(customerId, async () => {
    const { body } = await apiRoot.customers().withId({ ID: customerId }).get().execute();
    return body.customerGroup?.id;
  });
