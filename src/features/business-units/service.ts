import { localizeIn } from "@/lib/i18n";
import "server-only";
import type { BusinessUnit, Permission, Store } from "@commercetools/platform-sdk";
import { cache } from "react";
import { apiRoot } from "@/lib/commercetools/client";
import { staleWhileRevalidate } from "@/lib/memo";
import { cacheFor, TAGS } from "@/lib/cache";
import { B2C_STORE_KEY } from "@/lib/commercetools/stores";
import { str } from "@/lib/predicate";
import { contextsFor } from "@/features/business-units/utils";

// Sample-data stores have no countries set, so pick the currency/country their prices use.
// spain and us-* prices are country-restricted (ES / US) and only match when the country is sent.
// `externalPricing`: the store's units buy at company prices from the external price service (features/company-pricing:
// an NZ trade supplier's SAP-calculated prices); the store's channel holds the web price that catalog reads select.
const STORE_PRICING: Record<string, { currency: string; country?: string; externalPricing?: boolean }> = {
  [B2C_STORE_KEY]: { currency: "EUR" },
  "de-fr-uk": { currency: "EUR" },
  spain: { currency: "EUR", country: "ES" },
  "us-medium-customers": { currency: "USD", country: "US" },
  "us-large-customers": { currency: "USD", country: "US" },
  "nz-trade": { currency: "NZD", country: "NZ", externalPricing: true },
};

export const hasExternalPricing = (storeKey: string | undefined) => !!storeKey && !!STORE_PRICING[storeKey]?.externalPricing;

export type { BuyingContext, PricingContext, BuyerContext } from "@/features/business-units/types";
import type { BuyerContext, BuyingContext } from "@/features/business-units/types";

// Divisions with storeMode/associateMode FromParent expose stores/associates only as inherited*.
function effectiveStoreKey(bu: BusinessUnit): string | undefined {
  const stores = bu.storeMode === "FromParent" ? bu.inheritedStores : bu.stores;
  return stores?.[0]?.key;
}

type Shared = { stores: Store[]; rolePermissions: Map<string, Permission[]> };

// Company first, then its divisions, grouped by top-level company.
const unitOrder = (a: BusinessUnit, b: BusinessUnit) =>
  a.topLevelUnit.key.localeCompare(b.topLevelUnit.key) ||
  Number(a.unitType === "Division") - Number(b.unitType === "Division") ||
  a.name.localeCompare(b.name);

function toContext(bu: BusinessUnit, { stores, rolePermissions }: Shared): BuyingContext | undefined {
  const storeKey = effectiveStoreKey(bu);
  const store = stores.find((s) => s.key === storeKey);
  const channel = store?.distributionChannels[0];
  if (!store || !channel) return undefined; // can't price anything without a store channel
  // A store nobody configured must not sell at a guessed currency.
  const configured = STORE_PRICING[store.key];
  if (!configured) {
    console.error(`store ${store.key} is not in STORE_PRICING: its units can't be shopped`);
    return undefined;
  }
  const { externalPricing, ...pricing } = configured;
  const byId = (id?: string) => bu.addresses.find((a) => a.id === id);
  return {
    businessUnitKey: bu.key,
    businessUnitName: bu.name,
    unitType: bu.unitType,
    parentKey: bu.parentUnit?.key,
    storeKey: store.key,
    storeName: localizeIn(store.name) || store.key,
    channelId: channel.id,
    channelKey: channel.obj?.key,
    supplyChannelId: store.supplyChannels?.[0]?.id,
    ...pricing,
    // The unit key is the SAP business partner (CardCode) the price service knows.
    ...(externalPricing && { externalPriceCompany: bu.key }),
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
  };
}

const buildContexts = (units: BusinessUnit[], shared: Shared) => [...units].sort(unitOrder).flatMap((bu) => toContext(bu, shared) ?? []);

// Stores and roles change rarely and are the same for everyone.
const sharedMemo = staleWhileRevalidate<Shared>(5 * 60 * 1000);
const sharedData = () =>
  sharedMemo("shared", async () => {
    const [{ body: stores }, { body: roles }] = await Promise.all([
      apiRoot
        .stores()
        .get({ queryArgs: { limit: 100, expand: ["distributionChannels[*]"] } })
        .execute(),
      apiRoot
        .associateRoles()
        .get({ queryArgs: { limit: 100 } })
        .execute(),
    ]);
    return { stores: stores.results, rolePermissions: new Map(roles.results.map((r) => [r.key, r.permissions])) };
  });

async function unitsOf(customerId: string): Promise<BusinessUnit[]> {
  const id = str(customerId);
  const { body } = await apiRoot
    .businessUnits()
    .get({
      queryArgs: {
        where: `associates(customer(id=${id})) or inheritedAssociates(customer(id=${id}))`,
        sort: ["key asc"],
        limit: 200,
        withTotal: false,
      },
    })
    .execute();
  return body.results;
}

// The customer's own units, one query per customer: a project with thousands of units must not load them all to find
// a buyer's two. `associate` tells a business buyer whose units can't be shopped from a consumer. Cached for 60 seconds
// per process, and a value older than two minutes is reloaded rather than served (see maxStaleMs in src/lib/memo.ts).
// Order-critical paths re-check live (hasPermissionNow). Cart writes are enforced by commercetools on the customer token.
export type CustomerContexts = { contexts: BuyerContext[]; associate: boolean };
const customerMemo = staleWhileRevalidate<CustomerContexts>(60 * 1000, { maxStaleMs: 60 * 1000 });

export const getCustomerContexts = (customerId: string) =>
  customerMemo(customerId, async () => {
    const [units, shared] = await Promise.all([unitsOf(customerId), sharedData()]);
    return { contexts: contextsFor(buildContexts(units, shared), customerId), associate: units.length > 0 };
  });

// Call after changing associates or unit details, so the change shows on the next request in this process.
export const forgetBuyingContexts = () => {
  customerMemo.clear();
  sharedMemo.clear();
};

// Every unit, page by page, for scripts (`npm run ct:contexts`). The storefront never needs them all.
async function allBusinessUnits(): Promise<BusinessUnit[]> {
  const results: BusinessUnit[] = [];
  for (;;) {
    const last = results.at(-1)?.id;
    const { body } = await apiRoot
      .businessUnits()
      .get({ queryArgs: { limit: 500, sort: ["id asc"], withTotal: false, ...(last && { where: `id > ${str(last)}` }) } })
      .execute();
    results.push(...body.results);
    if (body.results.length < 500) return results;
  }
}

export async function getBuyingContexts(): Promise<BuyingContext[]> {
  const [units, shared] = await Promise.all([allBusinessUnits(), sharedData()]);
  return buildContexts(units, shared);
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
    storeName: localizeIn(store.name) || store.key,
    channelId: channel.id,
    channelKey: channel.obj?.key,
    supplyChannelId: store.supplyChannels?.[0]?.id,
    ...STORE_PRICING[store.key],
    addresses: [],
  };
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

// The guest context is the same for every visitor: cached and shared, refreshed hourly or when units change.
export const getGuestContext = () => loadGuestContext();
// A signed-in consumer: the B2C store's prices (their customer group's where it has its own), a cart and orders of
// their own, no business unit.
export const getConsumerContext = async (customerId: string): Promise<BuyerContext> => {
  const [guest, customerGroupId] = await Promise.all([getGuestContext(), customerGroupNow(customerId)]);
  return { ...guest, guest: false, consumer: true, businessUnitName: "Personal account", customerGroupId };
};

// The customer's group, set by the seller (Merchant Center or an ERP sync). Cached for 60 seconds per customer, like
// the units, so a change shows within a minute without a /me call on every page.
const groupMemo = staleWhileRevalidate<string | undefined>(60 * 1000);
const customerGroupNow = (customerId: string) =>
  groupMemo(customerId, async () => {
    const { body } = await apiRoot.customers().withId({ ID: customerId }).get().execute();
    return body.customerGroup?.id;
  });
