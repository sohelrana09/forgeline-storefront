// Pricing POC: quantity breaks on two price lists, the way an ERP price feed would load them (Magento with an ERP
// pricing API: one ladder per business partner and SKU; here a distribution channel per company).
//   company   Eagle Heavy Lift (eagle-heavy-lift-technologies-inc-us) buys from store us-large-customers, whose channel
//             no other unit uses: it is that company's price list (USD, 10% and 20% off).
//   public    guests and consumers without a customer group: the B2C rows on default-channel (EUR, 5% and 10% off).
// A product discount wins over tiers in commercetools, so the tiered SKUs are taken out of the "5 EUR off on all
// spare parts" discount (the other spare parts keep it); --remove restores its predicate.
//   npm run ct:tier-prices                      show the planned tiers next to the current ones (dry run)
//   npm run ct:tier-prices -- --yes             set the tiers (idempotent)
//   npm run ct:tier-prices -- --remove --yes    remove them again
//   npm run ct:tier-prices -- --check --yes     how commercetools picks prices: channel fallback, cart tiers, tiers
//                                               with a product discount; every row and cart it creates is removed
import type { Money, PriceTierDraft, StandalonePrice } from "@commercetools/platform-sdk";
import { apiRoot } from "../src/lib/commercetools/client";
import { SPARE_PARTS, breaksAt } from "./poc-prices";

const args = process.argv.slice(2);
const write = args.includes("--yes");
const CHANNEL = "us-large-customers";
const usd = (cents: number): Money => ({ currencyCode: "USD", centAmount: cents });

// Standalone price key → quantity breaks (minimum quantity, unit price in cents). Base prices stay as they are.
// The sample data keys a SKU's Eagle row `<sku>-8` and its plain EUR row on default-channel `<sku>-2`.
const TIERS: Record<string, [number, number][]> = Object.fromEntries(
  SPARE_PARTS.flatMap((part) => [
    [`${part.sku}-8`, breaksAt(part, [10, 20])],
    [`${part.sku}-2`, breaksAt(part, [5, 10])],
  ]),
);

const DISCOUNT = "spare-parts-5-eur-off";
const DISCOUNT_PREDICATE = 'categories.key contains "spare-parts"';
const withoutTiered = `${DISCOUNT_PREDICATE} and not(sku in (${SPARE_PARTS.map((p) => `"${p.sku}"`).join(", ")}))`;

const ladder = (p: Pick<StandalonePrice, "value" | "tiers">) =>
  [`1+ ${p.value.centAmount}`, ...(p.tiers ?? []).map((t) => `${t.minimumQuantity}+ ${t.value.centAmount}`)].join(", ");
const sameTiers = (p: StandalonePrice, want: PriceTierDraft[]) =>
  JSON.stringify((p.tiers ?? []).map((t) => [t.minimumQuantity, t.value.centAmount])) ===
  JSON.stringify(want.map((t) => [t.minimumQuantity, t.value.centAmount]));

async function setTiers(remove: boolean) {
  for (const [key, steps] of Object.entries(TIERS)) {
    const { body: price } = await apiRoot.standalonePrices().withKey({ key }).get().execute();
    const money = (cents: number): Money => ({ currencyCode: price.value.currencyCode, centAmount: cents });
    const want: PriceTierDraft[] = remove ? [] : steps.map(([minimumQuantity, cents]) => ({ minimumQuantity, value: money(cents) }));
    if (sameTiers(price, want)) {
      console.log(`= ${key} (${price.sku}): ${ladder(price)}`);
      continue;
    }
    const planned = ladder({ value: price.value, tiers: want.map((t) => ({ ...t, value: { ...price.value, ...t.value } })) });
    if (!write) {
      console.log(`~ ${key} (${price.sku}): ${ladder(price)}  →  ${planned}  (dry run, add --yes)`);
      continue;
    }
    await apiRoot
      .standalonePrices()
      .withKey({ key })
      .post({ body: { version: price.version, actions: [{ action: "setPriceTiers", tiers: want }] } })
      .execute();
    console.log(`~ ${key} (${price.sku}): ${planned}`);
  }
  await setDiscountPredicate(remove ? DISCOUNT_PREDICATE : withoutTiered);
}

async function setDiscountPredicate(predicate: string) {
  const { body: discount } = await apiRoot.productDiscounts().withKey({ key: DISCOUNT }).get().execute();
  if (discount.predicate === predicate) return console.log(`= ${DISCOUNT}: ${predicate}`);
  if (!write) return console.log(`~ ${DISCOUNT}: ${discount.predicate}  →  ${predicate}  (dry run, add --yes)`);
  await apiRoot
    .productDiscounts()
    .withKey({ key: DISCOUNT })
    .post({ body: { version: discount.version, actions: [{ action: "changePredicate", predicate }] } })
    .execute();
  console.log(`~ ${DISCOUNT}: ${predicate}`);
}

// Which price a product query and a cart pick. Prints facts; cleans up in `finally` even when a step fails.
async function check() {
  if (!write) {
    console.log("--check creates a temporary price, cart and tier and removes them again: add --yes to run it.");
    return;
  }
  const channels = await apiRoot
    .channels()
    .get({ queryArgs: { where: `key in ("${CHANNEL}", "default-warehouse")` } })
    .execute();
  const id = (key: string) => channels.body.results.find((c) => c.key === key)!.id;
  const selected = async (sku: string, channelId: string) => {
    const { body } = await apiRoot
      .productProjections()
      .get({
        queryArgs: {
          where: `masterVariant(sku="${sku}") or variants(sku="${sku}")`,
          priceCurrency: "USD",
          priceCountry: "US",
          priceChannel: channelId,
        },
      })
      .execute();
    const p = body.results[0];
    const v = [p.masterVariant, ...p.variants].find((x) => x.sku === sku);
    return v?.price ? `${v.price.key} ${v.price.value.centAmount}${v.price.channel ? "" : " (no channel)"}` : "no price";
  };

  const temp = "poc-fallback-fuel-filter";
  let cartId: string | undefined;
  let cartVersion = 0;
  const machine = "u123-qr-2015-8";
  let machineTiered = false;
  try {
    // 1. Fallback: a SKU with no row for the requested channel, but a row without a channel.
    console.log("1. Channel fallback (fuel-filter)");
    console.log(`   company channel, before:      ${await selected("fuel-filter", id(CHANNEL))}`);
    console.log(`   channel without prices:       ${await selected("fuel-filter", id("default-warehouse"))}`);
    await apiRoot
      .standalonePrices()
      .post({ body: { key: temp, sku: "fuel-filter", value: usd(2999), country: "US" } })
      .execute();
    console.log(`   + temporary row without channel (29.99)`);
    console.log(`   company channel, with it:     ${await selected("fuel-filter", id(CHANNEL))}`);
    console.log(`   channel without prices:       ${await selected("fuel-filter", id("default-warehouse"))}`);

    // 2. Cart: the line's unit price at a quantity that reaches a tier, and its total.
    console.log("2. Cart line prices (admin cart, deleted afterwards)");
    const { body: cart } = await apiRoot
      .carts()
      .post({
        body: {
          currency: "USD",
          country: "US",
          lineItems: [
            { sku: "air-filter", quantity: 3, distributionChannel: { typeId: "channel", key: CHANNEL } },
            { sku: "oil-filter", quantity: 12, distributionChannel: { typeId: "channel", key: CHANNEL } },
            { sku: "hydraulic-hose", quantity: 25, distributionChannel: { typeId: "channel", key: CHANNEL } },
          ],
        },
      })
      .execute();
    cartId = cart.id;
    cartVersion = cart.version;
    for (const l of cart.lineItems) {
      console.log(
        `   ${l.variant.sku} × ${l.quantity}: price.value ${l.price.value.centAmount}, tiers ${(l.price.tiers ?? []).length}, ` +
          `total ${l.totalPrice.centAmount} (= ${l.totalPrice.centAmount / l.quantity} each)`,
      );
    }

    // 3. Tiers on a price that also has a product discount (a machine: dump trucks 15% off).
    console.log("3. Tiers together with a product discount");
    const { body: m } = await apiRoot.standalonePrices().withKey({ key: machine }).get().execute();
    await apiRoot
      .standalonePrices()
      .withKey({ key: machine })
      .post({
        body: {
          version: m.version,
          actions: [{ action: "setPriceTiers", tiers: [{ minimumQuantity: 2, value: usd(m.value.centAmount - 100000) }] }],
        },
      })
      .execute();
    machineTiered = true;
    console.log(`   + temporary tier on ${machine}: 2+ ${m.value.centAmount - 100000} (base ${m.value.centAmount})`);
    const { body: withMachine } = await apiRoot
      .carts()
      .withId({ ID: cart.id })
      .post({
        body: {
          version: cartVersion,
          actions: [{ action: "addLineItem", sku: m.sku, quantity: 1, distributionChannel: { typeId: "channel", key: CHANNEL } }],
        },
      })
      .execute();
    cartVersion = withMachine.version;
    const machineLine = withMachine.lineItems.find((l) => l.variant.sku === m.sku)!;
    const { body: two } = await apiRoot
      .carts()
      .withId({ ID: cart.id })
      .post({
        body: {
          version: cartVersion,
          actions: [{ action: "changeLineItemQuantity", lineItemId: machineLine.id, quantity: 2 }],
        },
      })
      .execute();
    cartVersion = two.version;
    for (const l of [machineLine, two.lineItems.find((x) => x.id === machineLine.id)!]) {
      console.log(
        `   ${l.variant.sku} × ${l.quantity}: price.value ${l.price.value.centAmount}, discounted ${l.price.discounted?.value.centAmount ?? "-"}, ` +
          `total ${l.totalPrice.centAmount} (= ${l.totalPrice.centAmount / l.quantity} each)`,
      );
    }
  } finally {
    if (cartId)
      await apiRoot
        .carts()
        .withId({ ID: cartId })
        .delete({ queryArgs: { version: cartVersion } })
        .execute();
    await apiRoot
      .standalonePrices()
      .withKey({ key: temp })
      .get()
      .execute()
      .then(({ body }) =>
        apiRoot
          .standalonePrices()
          .withKey({ key: temp })
          .delete({ queryArgs: { version: body.version } })
          .execute(),
      )
      .catch((err) => (err?.body?.statusCode === 404 ? undefined : Promise.reject(err)));
    if (machineTiered) {
      const { body: m } = await apiRoot.standalonePrices().withKey({ key: machine }).get().execute();
      await apiRoot
        .standalonePrices()
        .withKey({ key: machine })
        .post({ body: { version: m.version, actions: [{ action: "setPriceTiers", tiers: [] }] } })
        .execute();
    }
    console.log("   cleaned up: temporary cart, price row and tier removed");
  }
}

const main = () => (args.includes("--check") ? check() : setTiers(args.includes("--remove")));

main().catch((err) => {
  console.error(err?.body ?? err);
  process.exit(1);
});
