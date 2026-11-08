import "server-only";
import { cache } from "react";
import type { ProductProjection } from "@commercetools/platform-sdk";
import { apiRoot } from "@/lib/commercetools/client";
import { statusOf } from "@/lib/commercetools/errors";
import { TAGS, cacheFor } from "@/lib/cache";
import { urlKey } from "@/lib/urls";
import { hasPermissionNow } from "@/features/business-units/service";
import type { PricingContext } from "@/features/business-units/types";
import { localize, relatedProductIds } from "@/features/catalog/utils";
import type { FitsOptions } from "@/features/catalog/layered";
import {
  EQUIPMENT_CONTAINER,
  applyEquipment,
  buildFitmentIndex,
  equipmentLabel,
  parseEquipment,
  type EquipmentChange,
  type EquipmentItem,
  type FitmentIndex,
} from "@/features/fitment/fitment";

// Fitment (docs/features/fitment.md). The index is the same for everyone (names and ids, no prices), cached like the
// catalog and cleared with it. Equipment is company data: any associate of the selected unit reads it, company admins
// (UpdateBusinessUnitDetails, checked live) change it.

export class EquipmentError extends Error {}

const PAGE = 500;

export async function getFitmentIndex(): Promise<FitmentIndex> {
  "use cache: remote";
  cacheFor("structure", TAGS.catalog);
  const products: ProductProjection[] = [];
  for (let last: string | undefined; ;) {
    const { body } = await apiRoot
      .productProjections()
      .get({
        queryArgs: {
          where: [`masterVariant(attributes(name = "relatedProducts"))`, ...(last ? [`id > "${last}"`] : [])],
          sort: ["id asc"],
          limit: PAGE,
          withTotal: false,
        },
      })
      .execute();
    products.push(...body.results);
    if (body.results.length < PAGE) break;
    last = body.results.at(-1)!.id;
  }
  return buildFitmentIndex(
    products.map((p) => ({
      id: p.id,
      slug: urlKey(localize(p.slug)),
      name: localize(p.name),
      sku: p.masterVariant.sku,
      related: relatedProductIds(p),
    })),
  );
}

const stored = (unitKey: string) => apiRoot.customObjects().withContainerAndKey({ container: EQUIPMENT_CONTAINER, key: unitKey });

async function readStored(unitKey: string) {
  return stored(unitKey)
    .get()
    .execute()
    .then((r) => ({ version: r.body.version as number | undefined, value: r.body.value as unknown }))
    .catch((err) => (statusOf(err) === 404 ? { version: undefined, value: undefined } : Promise.reject(err)));
}

// The selected unit's machines (per render). Businesses only: guests and consumers have none.
export const companyEquipment = cache(async (ctx: Pick<PricingContext, "businessUnitKey">): Promise<EquipmentItem[]> => {
  if (!ctx.businessUnitKey) return [];
  const [index, { value }] = await Promise.all([getFitmentIndex(), readStored(ctx.businessUnitKey)]);
  return parseEquipment(value, index);
});

// What the category page's "Fits" filter needs: every machine (links from product pages), and the company's in the facet.
export async function fitsOptions(ctx: Pick<PricingContext, "businessUnitKey">): Promise<FitsOptions> {
  const [index, equipment] = await Promise.all([getFitmentIndex(), companyEquipment(ctx)]);
  const options = Object.values(index.machines).map((m) => ({ slug: m.slug, name: m.name, ids: new Set(m.parts) }));
  const shown = [...new Set(equipment.map((e) => index.machines[e.machineId]?.slug).filter((s): s is string => !!s))];
  // The facet shows the company's own name for a machine when it gave one.
  for (const e of equipment) {
    const m = index.machines[e.machineId];
    const option = m && options.find((o) => o.slug === m.slug);
    if (option && e.label) option.name = `${e.label} (${m.name})`;
  }
  return { options, shown };
}

export async function canManageEquipment(ctx: PricingContext, customerId: string) {
  return !!ctx.businessUnitKey && hasPermissionNow(ctx.businessUnitKey, customerId, "UpdateBusinessUnitDetails");
}

export async function changeEquipment(ctx: PricingContext, actorId: string, change: EquipmentChange): Promise<string> {
  for (let attempt = 1; ; attempt++) {
    const [allowed, index, { version, value }] = await Promise.all([
      canManageEquipment(ctx, actorId),
      getFitmentIndex(),
      readStored(ctx.businessUnitKey),
    ]);
    if (!allowed) throw new EquipmentError("You can't change the company's equipment.");
    if (change.op === "add" && !index.machines[change.item.machineId]) throw new EquipmentError("Choose a machine from the list.");
    const current = parseEquipment(value, index);
    const next = applyEquipment(current, change);
    if (next.error) throw new EquipmentError(next.error);
    try {
      await apiRoot
        .customObjects()
        .post({
          body: {
            container: EQUIPMENT_CONTAINER,
            key: ctx.businessUnitKey,
            value: { items: next.items, updatedBy: actorId, updatedAt: new Date().toISOString() },
            ...(version !== undefined && { version }),
          },
        })
        .execute();
      const item = change.op === "add" ? change.item : current[change.index];
      return equipmentLabel(item, index.machines[item.machineId]);
    } catch (err) {
      if (statusOf(err) !== 409 || attempt === 3) throw err;
    }
  }
}
