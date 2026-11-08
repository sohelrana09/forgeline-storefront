import "server-only";
import { apiRoot } from "@/lib/commercetools/client";
import { statusOf } from "@/lib/commercetools/errors";
import { str } from "@/lib/predicate";
import { sendMail, siteUrl } from "@/lib/mailer";
import { reportEvent } from "@/lib/error-report";
import type { PricingContext } from "@/features/business-units/types";
import { allVariants, availableQuantity, localize, productHref } from "@/features/catalog/utils";
import { ALERTS_PER_CUSTOMER, ALERT_CONTAINER, alertKey, alertOutcome, parseAlert, type StockAlert } from "@/features/stock-alerts/alerts";

// Back-in-stock alerts (docs/features/b2c-engagement.md).

export class StockAlertError extends Error {}

const alerts = () => apiRoot.customObjects().withContainer({ container: ALERT_CONTAINER });

export async function hasAlert(customerId: string, sku: string): Promise<boolean> {
  return apiRoot
    .customObjects()
    .withContainerAndKey({ container: ALERT_CONTAINER, key: alertKey(customerId, sku) })
    .get()
    .execute()
    .then(() => true)
    .catch((err) => (statusOf(err) === 404 ? false : Promise.reject(err)));
}

// The variant must be sold in the customer's store and be out of stock there.
export async function createAlert(customerId: string, ctx: PricingContext, sku: string) {
  const { body } = await apiRoot
    .productProjections()
    .get({
      queryArgs: { where: `masterVariant(sku = ${str(sku)}) or variants(sku = ${str(sku)})`, storeProjection: ctx.storeKey, limit: 1 },
    })
    .execute();
  const product = body.results[0];
  const variant = product && allVariants(product).find((v) => v.sku === sku);
  if (!product || !variant) throw new StockAlertError("This product isn't sold to you.");
  const stock = availableQuantity(variant, ctx.supplyChannelId);
  if (stock === undefined || stock > 0) throw new StockAlertError("This product is available now.");
  const { body: mine } = await alerts()
    .get({ queryArgs: { where: `value(customerId = ${str(customerId)})`, limit: 0 } })
    .execute();
  if ((mine.total ?? 0) >= ALERTS_PER_CUSTOMER) throw new StockAlertError(`You can follow up to ${ALERTS_PER_CUSTOMER} products.`);
  const value: StockAlert = {
    sku,
    customerId,
    storeKey: ctx.storeKey,
    ...(ctx.supplyChannelId && { supplyChannelId: ctx.supplyChannelId }),
    productSlug: localize(product.slug),
    createdAt: new Date().toISOString(),
  };
  await apiRoot
    .customObjects()
    .post({ body: { container: ALERT_CONTAINER, key: alertKey(customerId, sku), value } })
    .execute();
}

export async function removeAlert(customerId: string, sku: string) {
  const key = alertKey(customerId, sku);
  const existing = await apiRoot
    .customObjects()
    .withContainerAndKey({ container: ALERT_CONTAINER, key })
    .get()
    .execute()
    .catch((err) => (statusOf(err) === 404 ? undefined : Promise.reject(err)));
  if (existing)
    await apiRoot
      .customObjects()
      .withContainerAndKey({ container: ALERT_CONTAINER, key })
      .delete({ queryArgs: { version: existing.body.version } })
      .execute();
}

// Daily cron: one product read per store and batch of SKUs, then mail or expire each alert.
export async function sweepStockAlerts(now = new Date()) {
  const result = { checked: 0, sent: 0, expired: 0, failed: 0 };
  const all: { key: string; version: number; alert: StockAlert }[] = [];
  for (let last: string | undefined; ;) {
    const { body } = await alerts()
      .get({ queryArgs: { sort: ["id asc"], limit: 500, withTotal: false, ...(last && { where: `id > ${str(last)}` }) } })
      .execute();
    for (const o of body.results) {
      const alert = parseAlert(o.value);
      if (alert) all.push({ key: o.key, version: o.version, alert });
    }
    if (body.results.length < 500) break;
    last = body.results.at(-1)!.id;
  }
  const byStore = Map.groupBy(all, (a) => a.alert.storeKey);
  for (const [storeKey, list] of byStore) {
    const skus = [...new Set(list.map((a) => a.alert.sku))];
    const stock = new Map<string, { quantity: (channel?: string) => number | undefined; name: string; slug: string }>();
    for (let i = 0; i < skus.length; i += 100) {
      const batch = skus
        .slice(i, i + 100)
        .map(str)
        .join(", ");
      const { body } = await apiRoot
        .productProjections()
        .get({
          queryArgs: { where: `masterVariant(sku in (${batch})) or variants(sku in (${batch}))`, storeProjection: storeKey, limit: 500 },
        })
        .execute();
      for (const p of body.results)
        for (const v of allVariants(p))
          if (v.sku)
            stock.set(v.sku, { quantity: (channel) => availableQuantity(v, channel), name: localize(p.name), slug: localize(p.slug) });
    }
    for (const { key, version, alert } of list) {
      result.checked++;
      const product = stock.get(alert.sku);
      const outcome = alertOutcome(alert, product ? product.quantity(alert.supplyChannelId) : null, now);
      if (outcome === "wait") continue;
      try {
        if (outcome === "send") {
          const customer = await apiRoot
            .customers()
            .withId({ ID: alert.customerId })
            .get()
            .execute()
            .then((r) => r.body)
            .catch(() => undefined);
          if (customer?.email) {
            const sent = await sendMail({
              to: customer.email,
              subject: `${product!.name} is back in stock`,
              text: `Good news: ${product!.name} (${alert.sku}) is back in stock.\n\nOrder it: ${siteUrl()}${productHref(product!.slug, alert.sku)}\n\nYou asked us to tell you once. We won't email you about it again.`,
            });
            if (!sent) throw new Error("mail not sent");
            result.sent++;
          }
        } else result.expired++;
        await apiRoot.customObjects().withContainerAndKey({ container: ALERT_CONTAINER, key }).delete({ queryArgs: { version } }).execute();
      } catch (err) {
        result.failed++;
        reportEvent("stock_alert_failed", err, { sku: alert.sku });
      }
    }
  }
  return result;
}
