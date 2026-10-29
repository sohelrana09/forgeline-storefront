// Pricing POC: one company's own price list with quantity breaks, the way an ERP price feed would load it
// (Magento with an ERP pricing API: one ladder per business partner and SKU; here a distribution channel per company).
// Eagle Heavy Lift (eagle-heavy-lift-technologies-inc-us) buys from store us-large-customers, whose channel
// us-large-customers no other unit uses: it is that company's price list.
//   npm run ct:tier-prices                      show the planned tiers next to the current ones (dry run)
//   npm run ct:tier-prices -- --yes             set the tiers (idempotent)
//   npm run ct:tier-prices -- --remove --yes    remove them again
//   npm run ct:tier-prices -- --check --yes     how commercetools picks prices: channel fallback, cart tiers, tiers
//                                               with a product discount; every row and cart it creates is removed
import type { Money, PriceTierDraft, StandalonePrice } from "@commercetools/platform-sdk";
import { apiRoot } from "../src/lib/commercetools/client";

const args = process.argv.slice(2);
const write = args.includes("--yes");
const CHANNEL = "us-large-customers";
const usd = (cents: number): Money => ({ currencyCode: "USD", centAmount: cents });

// Standalone price key → quantity breaks (minimum quantity, unit price in cents). Base prices stay as they are.
const TIERS: Record<string, [number, number][]> = {
  "air-filter-8": [
    [10, 3600],
    [50, 3200],
  ],
  "oil-filter-8": [
    [12, 2475],
    [48, 2200],
  ],
  "hydraulic-hose-8": [
    [5, 6900],
    [20, 6250],
  ],
};

const ladder = (p: Pick<StandalonePrice, "value" | "tiers">) =>
  [`1+ ${p.value.centAmount}`, ...(p.tiers ?? []).map((t) => `${t.minimumQuantity}+ ${t.value.centAmount}`)].join(", ");
const sameTiers = (p: StandalonePrice, want: PriceTierDraft[]) =>
  JSON.stringify((p.tiers ?? []).map((t) => [t.minimumQuantity, t.value.centAmount])) ===
  JSON.stringify(want.map((t) => [t.minimumQuantity, t.value.centAmount]));

async function setTiers(remove: boolean) {
  for (const [key, steps] of Object.entries(TIERS)) {
    const { body: price } = await apiRoot.standalonePrices().withKey({ key }).get().execute();
    const want: PriceTierDraft[] = remove ? [] : steps.map(([minimumQuantity, cents]) => ({ minimumQuantity, value: usd(cents) }));
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
