// Pricing POC: B2C prices per customer group (Magento: partner members price as their own "company").
// Guests and consumers without a group keep the public price on the B2C channel; members of `trade-members` get
// their own rows on the same channel, with their own quantity breaks: 10% off the public price, then 15% and 20% at
// the SKU's break quantities (the public rows get 5% and 10% from ct:tier-prices). Product discounts apply on top of
// group prices like on public ones, but the tiered SKUs are out of the spare-parts discount (see ct:tier-prices).
//   npm run ct:customer-group-prices                              plan (dry run)
//   npm run ct:customer-group-prices -- --yes                     group + its prices (idempotent)
//   npm run ct:customer-group-prices -- --assign <email> --yes    put a consumer in the group (--unassign to undo)
//   npm run ct:customer-group-prices -- --check                   which price a query and a cart pick (read-only
//                                                                 except a temporary cart, deleted afterwards)
//   npm run ct:customer-group-prices -- --remove --yes            prices, memberships and group removed
import type { Customer, Money, PriceTierDraft, StandalonePrice } from "@commercetools/platform-sdk";
import { apiRoot } from "../src/lib/commercetools/client";
import { str } from "../src/lib/predicate";
import { SPARE_PARTS, breaksAt, off } from "./poc-prices";

const args = process.argv.slice(2);
const arg = (name: string) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const write = args.includes("--yes");
const GROUP = { key: "trade-members", groupName: "Trade members" };
const CHANNEL = "default-channel";
const CURRENCY = "EUR";
// SKU → the group's unit price in cents and its quantity breaks.
const PRICES: Record<string, { cents: number; tiers: (PriceTierDraft & { value: Money })[] }> = Object.fromEntries(
  SPARE_PARTS.map((part) => [
    part.sku,
    {
      cents: off(part.base, 10),
      tiers: breaksAt(part, [15, 20]).map(([minimumQuantity, cents]) => ({
        minimumQuantity,
        value: { currencyCode: CURRENCY, centAmount: cents },
      })),
    },
  ]),
);
const ladder = (cents: number, tiers: { minimumQuantity: number; value: { centAmount: number } }[]) =>
  [`1+ ${cents}`, ...tiers.map((t) => `${t.minimumQuantity}+ ${t.value.centAmount}`)].join(", ");
const priceKey = (sku: string) => `${sku}-${GROUP.key}`;

const notFound = (err: { body?: { statusCode?: number } }) => (err?.body?.statusCode === 404 ? undefined : Promise.reject(err));
const findGroup = () =>
  apiRoot
    .customerGroups()
    .withKey({ key: GROUP.key })
    .get()
    .execute()
    .then((r) => r.body)
    .catch(notFound);
const findPrice = (key: string) =>
  apiRoot
    .standalonePrices()
    .withKey({ key })
    .get()
    .execute()
    .then((r) => r.body as StandalonePrice)
    .catch(notFound);
const findCustomer = async (email: string): Promise<Customer> => {
  const { body } = await apiRoot
    .customers()
    .get({ queryArgs: { where: `lowercaseEmail=${str(email.toLowerCase())}`, limit: 1 } })
    .execute();
  if (!body.results[0]) throw new Error(`No customer ${email}`);
  return body.results[0];
};
const dry = (line: string) => console.log(`${line}  (dry run, add --yes)`);

async function seed() {
  let group = await findGroup();
  if (group) console.log(`= customer group ${GROUP.key}`);
  else if (!write) dry(`+ customer group ${GROUP.key} (${GROUP.groupName})`);
  else {
    group = (await apiRoot.customerGroups().post({ body: GROUP }).execute()).body;
    console.log(`+ customer group ${GROUP.key} (${GROUP.groupName})`);
  }
  for (const [sku, { cents, tiers }] of Object.entries(PRICES)) {
    const key = priceKey(sku);
    const existing = await findPrice(key);
    const want = ladder(cents, tiers);
    const current = existing && ladder(existing.value.centAmount, existing.tiers ?? []);
    if (current === want) {
      console.log(`= ${key}: ${want}`);
      continue;
    }
    if (!write || !group) {
      dry(`${existing ? `~ ${key}: ${current}  →` : `+ ${key}: ${sku} ${CURRENCY}`} ${want} on ${CHANNEL}, group ${GROUP.key}`);
      continue;
    }
    if (existing) {
      await apiRoot
        .standalonePrices()
        .withKey({ key })
        .post({
          body: {
            version: existing.version,
            actions: [
              { action: "changeValue", value: { currencyCode: CURRENCY, centAmount: cents } },
              { action: "setPriceTiers", tiers },
            ],
          },
        })
        .execute();
      console.log(`~ ${key}: ${current} → ${want}`);
      continue;
    }
    await apiRoot
      .standalonePrices()
      .post({
        body: {
          key,
          sku,
          value: { currencyCode: CURRENCY, centAmount: cents },
          channel: { typeId: "channel", key: CHANNEL },
          customerGroup: { typeId: "customer-group", key: GROUP.key },
          tiers,
        },
      })
      .execute();
    console.log(`+ ${key}: ${sku} ${CURRENCY} ${want} on ${CHANNEL}, group ${GROUP.key}`);
  }
}

async function assign(email: string, join: boolean) {
  const customer = await findCustomer(email);
  const group = join ? await findGroup() : undefined;
  if (join && !group) throw new Error(`Create the group first: npm run ct:customer-group-prices -- --yes`);
  const member = customer.customerGroup?.id === group?.id;
  if (join ? member : !customer.customerGroup) {
    console.log(`= ${email}: ${join ? `already in ${GROUP.key}` : "in no group"}`);
    return;
  }
  if (!write) return dry(`~ ${email}: ${join ? `join ${GROUP.key}` : "leave its group"}`);
  await apiRoot
    .customers()
    .withId({ ID: customer.id })
    .post({
      body: {
        version: customer.version,
        actions: [{ action: "setCustomerGroup", ...(group && { customerGroup: { typeId: "customer-group", id: group.id } }) }],
      },
    })
    .execute();
  console.log(`~ ${email}: ${join ? `joined ${GROUP.key}` : "left its group"}`);
}

async function remove() {
  const group = await findGroup();
  for (const sku of Object.keys(PRICES)) {
    const p = await findPrice(priceKey(sku));
    if (!p) continue;
    if (!write) dry(`- ${p.key}`);
    else {
      await apiRoot
        .standalonePrices()
        .withKey({ key: p.key! })
        .delete({ queryArgs: { version: p.version } })
        .execute();
      console.log(`- ${p.key}`);
    }
  }
  if (!group) return;
  const { body: members } = await apiRoot
    .customers()
    .get({ queryArgs: { where: `customerGroup(id="${group.id}")`, limit: 500 } })
    .execute();
  for (const c of members.results) await assign(c.email, false);
  if (!write) return dry(`- customer group ${GROUP.key}`);
  const { body: fresh } = await apiRoot.customerGroups().withKey({ key: GROUP.key }).get().execute();
  await apiRoot
    .customerGroups()
    .withKey({ key: GROUP.key })
    .delete({ queryArgs: { version: fresh.version } })
    .execute();
  console.log(`- customer group ${GROUP.key}`);
}

async function check() {
  const group = await findGroup();
  if (!group) throw new Error("No group yet: npm run ct:customer-group-prices -- --yes");
  const { body: channel } = await apiRoot.channels().withKey({ key: CHANNEL }).get().execute();
  const pick = async (sku: string, customerGroup?: string) => {
    const { body } = await apiRoot
      .productProjections()
      .get({
        queryArgs: {
          where: `masterVariant(sku="${sku}")`,
          priceCurrency: CURRENCY,
          priceChannel: channel.id,
          ...(customerGroup && { priceCustomerGroup: customerGroup }),
        },
      })
      .execute();
    const price = body.results[0]?.masterVariant.price;
    return price ? `${price.key} ${price.value.centAmount} (discounted ${price.discounted?.value.centAmount ?? "-"})` : "no price";
  };
  console.log("1. Product query on the B2C channel");
  for (const sku of [...Object.keys(PRICES), "pneumatic-tire"]) {
    console.log(`   ${sku.padEnd(15)} no group: ${await pick(sku)}  |  ${GROUP.key}: ${await pick(sku, group.id)}`);
  }

  // The cart takes its group from the customer when a customerId is set; without a member, set the group directly.
  const { body: members } = await apiRoot
    .customers()
    .get({ queryArgs: { where: `customerGroup(id="${group.id}")`, limit: 1 } })
    .execute();
  const member = members.results[0];
  if (!write) return console.log("2. Cart check creates a temporary cart: add --yes to run it.");
  console.log(`2. Cart (${member ? `customerId of member ${member.email}` : "customerGroup set directly"}; deleted afterwards)`);
  const { body: cart } = await apiRoot
    .carts()
    .post({
      body: {
        currency: CURRENCY,
        ...(member ? { customerId: member.id } : { customerGroup: { typeId: "customer-group", id: group.id } }),
        lineItems: [{ sku: "air-filter", quantity: 2, distributionChannel: { typeId: "channel", key: CHANNEL } }],
      },
    })
    .execute();
  try {
    const l = cart.lineItems[0];
    console.log(`   cart.customerGroup ${cart.customerGroup ? GROUP.key : "-"}`);
    console.log(
      `   air-filter × 2: ${l.price.key} ${l.price.value.centAmount}, discounted ${l.price.discounted?.value.centAmount ?? "-"}, total ${l.totalPrice.centAmount}`,
    );
  } finally {
    await apiRoot
      .carts()
      .withId({ ID: cart.id })
      .delete({ queryArgs: { version: cart.version } })
      .execute();
    console.log("   temporary cart deleted");
  }
}

async function main() {
  if (args.includes("--check")) return check();
  if (args.includes("--remove")) return remove();
  const email = arg("--assign") ?? arg("--unassign");
  if (email) return assign(email, args.includes("--assign"));
  return seed();
}

main().catch((err) => {
  console.error(err?.body ?? err);
  process.exit(1);
});
