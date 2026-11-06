// NZ trade company pricing POC (docs/nz-trade-pricing.md): a real slice of an NZ trade supplier's shop (Adobe Commerce, NZD) in this
// project. Web prices (WEBSALES) become Standalone Prices; the companies' SAP-calculated prices go to the price store
// (the shop's KeyDB model) and reach carts through the API Extension (/api/price-extension).
// Input: the git-ignored dumps in data/nz-trade/ (pricing-api-response.tsv, products.tsv; commands in the doc).
//   npm run ct:nz-trade                              dry run: the slice and what would be created
//   npm run ct:nz-trade -- --yes                     project NZD/NZ, channel, store, tax, shipping, products, web prices
//   npm run ct:nz-trade -- --units --yes             business units (key = CardCode) and demo buyers; first give the
//                                                  storefront API client the "nz-trade" store scopes (sign-in needs them)
//   npm run ct:nz-trade -- --prices [--yes]          change-only sync of the company prices into the price store
//   npm run ct:nz-trade -- --extension --url https://… --yes   register or update the API Extension
//   npm run ct:nz-trade -- --check                   web price selection; with the extension, a temporary cart per
//                                                  company (company prices, tiers by quantity), removed afterwards
//   npm run ct:nz-trade -- --remove --yes            delete everything above (the project keeps NZD and NZ)
// Options: --companies CRO106,HYD102  --skus A,B  --limit 40
import { readFileSync } from "node:fs";
import path from "node:path";
import type { Cart, LocalizedString, TypedMoney, TypedMoneyDraft } from "@commercetools/platform-sdk";
import { apiRoot } from "../src/lib/commercetools/client";
import { parseLadder, toMoneyDraft } from "../src/features/company-pricing/ladder";
import { diffLadders } from "../src/features/company-pricing/sync";
import {
  companyKeys,
  priceKey,
  PriceStoreUnavailable,
  priceStoreName,
  readLadderFields,
  writeLadderFields,
} from "../src/features/company-pricing/store";
import type { Ladder, LadderFields } from "../src/features/company-pricing/types";

const args = process.argv.slice(2);
const write = args.includes("--yes");
const option = (name: string) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};

const STORE = "nz-trade";
const CHANNEL = "nz-trade-web";
const SELECTION = "nz-trade";
const TAX = "nz-trade-gst";
const ZONE = "nz";
const SHIPPING = "nz-trade-freight";
const PRODUCT_TYPE = "nz-trade-part";
const CATEGORY = "nz-trade";
const EXTENSION = "nz-trade-company-prices";
const WEB = "WEBSALES";
const CURRENCY = "NZD";
const COMPANIES = (option("--companies") ?? "CRO106,HYD102,DES108,EAS142,ENZ103,ALS115").split(",");
const LIMIT = Number(option("--limit") ?? 40);
const DATA = path.join(process.cwd(), "data", "nz-trade");

const text = (value: string): LocalizedString => ({ "en-US": value, "en-GB": value, "en-NZ": value });
const keyOf = (sku: string) => sku.toLowerCase().replace(/[^a-z0-9]+/g, "-");
const productKey = (sku: string) => `nz-trade-${keyOf(sku)}`;
const priceKeyOf = (sku: string) => `nz-trade-web-${keyOf(sku)}`;
const buyerKey = (code: string) => `nz-trade-${code.toLowerCase()}`;
const buyerEmail = (code: string) => `nz-trade-${code.toLowerCase()}@example.com`;
const statusOf = (err: unknown) => (err as { body?: { statusCode?: number } })?.body?.statusCode;
const missing = <T>(promise: Promise<T>) => promise.catch((err) => (statusOf(err) === 404 ? undefined : Promise.reject(err)));
const say = (done: boolean, line: string) =>
  console.log(`${done ? "=" : write ? "+" : "~"} ${line}${done || write ? "" : "  (dry run, add --yes)"}`);

// ---------- The slice ----------

type Product = { sku: string; name: string; urlKey: string; description: string; brand: string };

function readSlice() {
  const prices = new Map<string, Record<string, LadderFields>>();
  for (const line of readFileSync(path.join(DATA, "pricing-api-response.tsv"), "utf8").split("\n")) {
    const [company, json] = line.split("\t");
    if (company && json && json !== "NULL") prices.set(company.trim(), JSON.parse(json));
  }
  const products = new Map<string, Product>();
  for (const line of readFileSync(path.join(DATA, "products.tsv"), "utf8").split("\n")) {
    const [sku, name, urlKey, description, brand] = line.split("\t");
    if (sku && name) products.set(sku, { sku, name, urlKey: urlKey || keyOf(sku), description: description ?? "", brand: brand ?? "" });
  }
  const web = prices.get(WEB);
  if (!web) throw new Error(`no ${WEB} row in data/nz-trade/pricing-api-response.tsv`);
  for (const code of COMPANIES) if (!prices.has(code)) throw new Error(`company ${code} has no prices in the dump`);

  const ladderOf = (company: string, sku: string) => parseLadder(prices.get(company)?.[sku]);
  // SKUs the storefront can handle (quick order allows [A-Za-z0-9._-]) with a web price and a price for every company.
  const candidates = [...products.keys()]
    .filter((sku) => /^[A-Za-z0-9._-]+$/.test(sku) && ladderOf(WEB, sku) && COMPANIES.every((c) => ladderOf(c, sku)))
    .sort();
  const chosen =
    option("--skus")?.split(",") ??
    [
      // Quantity breaks first (the tier lesson), then the rest in SKU order.
      ...candidates.filter((sku) => ladderOf(WEB, sku)!.length > 1).slice(0, Math.ceil(LIMIT / 3)),
      ...candidates.filter((sku) => ladderOf(WEB, sku)!.length === 1),
    ].slice(0, LIMIT);
  const skus = chosen.filter((sku) => products.has(sku) && ladderOf(WEB, sku));
  return {
    skus,
    product: (sku: string) => products.get(sku)!,
    web: (sku: string) => ladderOf(WEB, sku)!,
    ladderOf,
    companyFields: (company: string, sku: string) => prices.get(company)?.[sku],
  };
}

type Slice = ReturnType<typeof readSlice>;

const money = (price: string): TypedMoneyDraft => toMoneyDraft(price, CURRENCY);
// One money's identity, for comparing stored prices with the dump (cent or high precision alike).
const moneyId = (m: TypedMoneyDraft | { type?: string; centAmount?: number; preciseAmount?: number; fractionDigits?: number }) =>
  m.type === "highPrecision"
    ? `h${(m as { preciseAmount: number }).preciseAmount}/${m.fractionDigits}`
    : `c${(m as { centAmount: number }).centAmount}`;
const tiersOf = (ladder: Ladder) => ladder.slice(1).map((s) => ({ minimumQuantity: s.minQuantity, value: money(s.price) }));

// ---------- Catalog, store and web prices ----------

async function ensureProject() {
  const { body: project } = await apiRoot.get().execute();
  const hasAll = project.currencies.includes(CURRENCY) && project.countries.includes("NZ");
  say(hasAll, `project: currency ${CURRENCY}, country NZ`);
  if (hasAll || !write) return;
  await apiRoot
    .post({
      body: {
        version: project.version,
        actions: [
          { action: "changeCurrencies", currencies: [...new Set([...project.currencies, CURRENCY])] },
          { action: "changeCountries", countries: [...new Set([...project.countries, "NZ"])] },
        ],
      },
    })
    .execute();
}

// Creates the resource when its key is missing (idempotent).
async function ensure(label: string, exists: () => Promise<unknown>, create: () => Promise<unknown>) {
  const found = await missing(exists());
  say(!!found, label);
  if (!found && write) await create();
}

async function setupCatalog(slice: Slice) {
  await ensureProject();
  await ensure(
    `channel ${CHANNEL}`,
    () => apiRoot.channels().withKey({ key: CHANNEL }).get().execute(),
    () =>
      apiRoot
        .channels()
        .post({ body: { key: CHANNEL, roles: ["ProductDistribution"], name: text("NZ Trade web prices (WEBSALES)") } })
        .execute(),
  );
  await ensure(
    `tax category ${TAX} (NZ GST 15%, prices excl. GST)`,
    () => apiRoot.taxCategories().withKey({ key: TAX }).get().execute(),
    () =>
      apiRoot
        .taxCategories()
        .post({ body: { key: TAX, name: "NZ Trade GST", rates: [{ name: "GST", amount: 0.15, includedInPrice: false, country: "NZ" }] } })
        .execute(),
  );
  await ensure(
    `zone ${ZONE}`,
    () => apiRoot.zones().withKey({ key: ZONE }).get().execute(),
    () =>
      apiRoot
        .zones()
        .post({ body: { key: ZONE, name: "New Zealand", locations: [{ country: "NZ" }] } })
        .execute(),
  );
  await ensure(
    `shipping method ${SHIPPING} (NZ$15, free over NZ$200)`,
    () => apiRoot.shippingMethods().withKey({ key: SHIPPING }).get().execute(),
    () =>
      apiRoot
        .shippingMethods()
        .post({
          body: {
            key: SHIPPING,
            name: "NZ Trade freight",
            localizedName: text("Freight"),
            isDefault: false,
            active: true,
            taxCategory: { typeId: "tax-category", key: TAX },
            zoneRates: [
              {
                zone: { typeId: "zone", key: ZONE },
                shippingRates: [
                  {
                    price: { currencyCode: CURRENCY, centAmount: 1500 },
                    freeAbove: { currencyCode: CURRENCY, centAmount: 20000 },
                  },
                ],
              },
            ],
          },
        })
        .execute(),
  );
  await ensure(
    `product type ${PRODUCT_TYPE}`,
    () => apiRoot.productTypes().withKey({ key: PRODUCT_TYPE }).get().execute(),
    () =>
      apiRoot
        .productTypes()
        .post({
          body: {
            key: PRODUCT_TYPE,
            name: "NZ Trade part",
            description: "Products of the NZ trade pricing POC (docs/nz-trade-pricing.md)",
            attributes: [{ name: "brand", label: text("Brand"), type: { name: "text" }, isRequired: false, isSearchable: true }],
          },
        })
        .execute(),
  );
  await ensure(
    `category ${CATEGORY}`,
    () => apiRoot.categories().withKey({ key: CATEGORY }).get().execute(),
    () =>
      apiRoot
        .categories()
        .post({ body: { key: CATEGORY, name: text("NZ Trade"), slug: text("nz-trade"), orderHint: "0.99" } })
        .execute(),
  );
  await ensure(
    `product selection ${SELECTION}`,
    () => apiRoot.productSelections().withKey({ key: SELECTION }).get().execute(),
    () =>
      apiRoot
        .productSelections()
        .post({ body: { key: SELECTION, name: text("NZ Trade"), mode: "Individual" } })
        .execute(),
  );
  await ensure(
    `store ${STORE} (channel ${CHANNEL}, selection ${SELECTION})`,
    () => apiRoot.stores().withKey({ key: STORE }).get().execute(),
    () =>
      apiRoot
        .stores()
        .post({
          body: {
            key: STORE,
            name: text("NZ Trade"),
            languages: ["en-US", "en-NZ"],
            distributionChannels: [{ typeId: "channel", key: CHANNEL }],
            productSelections: [{ productSelection: { typeId: "product-selection", key: SELECTION }, active: true }],
          },
        })
        .execute(),
  );

  for (const sku of slice.skus) await ensureProduct(slice, sku);
  console.log(`${slice.skus.length} products with web prices`);
}

async function ensureProduct(slice: Slice, sku: string) {
  const p = slice.product(sku);
  const key = productKey(sku);
  await ensure(
    `product ${key} ${sku} ${p.name}`,
    () => apiRoot.products().withKey({ key }).get().execute(),
    async () => {
      await apiRoot
        .products()
        .post({
          body: {
            key,
            productType: { typeId: "product-type", key: PRODUCT_TYPE },
            name: text(p.name),
            slug: text(p.urlKey.toLowerCase()),
            ...(p.description && { description: text(p.description) }),
            categories: [{ typeId: "category", key: CATEGORY }],
            taxCategory: { typeId: "tax-category", key: TAX },
            // Price selection reads Standalone Prices only for products in Standalone mode (new products default to embedded).
            priceMode: "Standalone",
            masterVariant: { sku, ...(p.brand && { attributes: [{ name: "brand", value: p.brand }] }) },
            publish: true,
          },
        })
        .execute();
      const { body: selection } = await apiRoot.productSelections().withKey({ key: SELECTION }).get().execute();
      await apiRoot
        .productSelections()
        .withKey({ key: SELECTION })
        .post({ body: { version: selection.version, actions: [{ action: "addProduct", product: { typeId: "product", key } }] } })
        .execute();
    },
  );
  const existing = await missing(
    apiRoot
      .products()
      .withKey({ key })
      .get()
      .execute()
      .then((r) => r.body),
  );
  if (existing && existing.priceMode !== "Standalone") {
    say(false, `product ${key}: price mode Standalone`);
    if (write)
      await apiRoot
        .products()
        .withKey({ key })
        .post({ body: { version: existing.version, actions: [{ action: "setPriceMode", priceMode: "Standalone" }] } })
        .execute();
  }
  // The web price: base value and quantity breaks, on the store's channel, kept in line with the dump.
  const ladder = slice.web(sku);
  const pkey = priceKeyOf(sku);
  const price = await missing(
    apiRoot
      .standalonePrices()
      .withKey({ key: pkey })
      .get()
      .execute()
      .then((r) => r.body),
  );
  const want = { value: money(ladder[0].price), tiers: tiersOf(ladder) };
  const same =
    price &&
    JSON.stringify([moneyId(price.value), ...(price.tiers ?? []).map((t) => `${t.minimumQuantity}+${moneyId(t.value)}`)]) ===
      JSON.stringify([moneyId(want.value), ...want.tiers.map((t) => `${t.minimumQuantity}+${moneyId(t.value)}`)]);
  const ladderText = ladder.map((s) => `${s.minQuantity}+ ${s.price}`).join(", ");
  say(!!same, `web price ${pkey}: ${ladderText}`);
  if (same || !write) return;
  if (price)
    await apiRoot
      .standalonePrices()
      .withKey({ key: pkey })
      .post({
        body: {
          version: price.version,
          actions: [
            { action: "changeValue", value: want.value },
            { action: "setPriceTiers", tiers: want.tiers },
          ],
        },
      })
      .execute();
  else
    await apiRoot
      .standalonePrices()
      .post({ body: { key: pkey, sku, ...want, channel: { typeId: "channel", key: CHANNEL } } })
      .execute();
}

// ---------- Business units and demo buyers ----------

async function setupUnits() {
  const password = process.env.DEMO_BUYER_PASSWORD;
  if (!password) throw new Error("DEMO_BUYER_PASSWORD missing (create .env.demo)");
  if (process.env.CTP_PROJECT_KEY !== "ctwara") throw new Error("demo buyers are created in the ctwara sandbox only");
  console.log(`The storefront API client needs the "${STORE}" store scopes first, or every sign-in fails (CLAUDE.md).`);
  for (const code of COMPANIES) {
    await ensure(
      `customer ${buyerEmail(code)} (demo password from .env.demo)`,
      () =>
        apiRoot
          .customers()
          .withKey({ key: buyerKey(code) })
          .get()
          .execute(),
      () =>
        apiRoot
          .customers()
          .post({
            body: {
              key: buyerKey(code),
              email: buyerEmail(code),
              password,
              firstName: "Demo",
              lastName: `Buyer ${code}`,
              isEmailVerified: true,
            },
          })
          .execute(),
    );
    // The first company's buyer also buys for the second, to try the company switcher.
    const buyers = code === COMPANIES[1] ? [code, COMPANIES[0]] : [code];
    await ensure(
      `business unit ${code} "NZ Trade ${code}" (store ${STORE}; buyers ${buyers.map(buyerEmail).join(", ")})`,
      () => apiRoot.businessUnits().withKey({ key: code }).get().execute(),
      () =>
        apiRoot
          .businessUnits()
          .post({
            body: {
              key: code,
              unitType: "Company",
              name: `NZ Trade ${code}`,
              storeMode: "Explicit",
              stores: [{ typeId: "store", key: STORE }],
              addresses: [
                { key: "main", country: "NZ", city: "Auckland", streetName: "Demo Street", streetNumber: "1", postalCode: "1010" },
              ],
              defaultShippingAddress: 0,
              defaultBillingAddress: 0,
              associates: buyers.map((b) => ({
                customer: { typeId: "customer", key: buyerKey(b) },
                associateRoleAssignments: [{ associateRole: { typeId: "associate-role", key: "buyer" } }],
              })),
            },
          })
          .execute(),
    );
  }
}

// ---------- Company prices: change-only sync into the price store ----------

async function syncPrices(slice: Slice) {
  const next: Record<string, LadderFields> = {};
  for (const code of COMPANIES)
    for (const sku of slice.skus) {
      const fields = slice.companyFields(code, sku);
      if (fields) next[priceKey(code, sku)] = fields;
    }
  const keys = [...new Set([...Object.keys(next), ...(await companyKeys(COMPANIES))])];
  // A first sync without Redis starts from an empty file.
  const stored = await readLadderFields(keys).catch((err) =>
    err instanceof PriceStoreUnavailable ? keys.map(() => null) : Promise.reject(err),
  );
  const diff = diffLadders(next, new Map(keys.map((k, i) => [k, stored[i]])));
  console.log(
    `price store ${priceStoreName()}: ${diff.added} new, ${diff.changed} changed, ${diff.remove.length} removed, ${diff.unchanged} unchanged`,
  );
  if (!write) return console.log("dry run: add --yes to write the changes");
  await writeLadderFields(diff.set, diff.remove);
  console.log("written");
}

// ---------- API Extension ----------

async function registerExtension() {
  const url = option("--url");
  const secret = process.env.PRICE_EXTENSION_SECRET;
  if (!url?.startsWith("https://")) throw new Error("--url https://<public host> is required (a tunnel or deployment)");
  if (!secret || secret.length < 32) throw new Error("PRICE_EXTENSION_SECRET (32+ characters) missing in .env");
  const destination = {
    type: "HTTP" as const,
    url: `${url.replace(/\/$/, "")}/api/price-extension`,
    authentication: { type: "AuthorizationHeader" as const, headerValue: `Bearer ${secret}` },
  };
  // Only NZ trade carts of a business unit: the rest of the sandbox (and its e2e tests) never calls the endpoint.
  const triggers = [
    {
      resourceTypeId: "cart" as const,
      actions: ["Create" as const, "Update" as const],
      condition: `store(key = "${STORE}") and businessUnit is defined`,
    },
  ];
  const found = await missing(
    apiRoot
      .extensions()
      .withKey({ key: EXTENSION })
      .get()
      .execute()
      .then((r) => r.body),
  );
  say(false, `extension ${EXTENSION} → ${destination.url} (${found ? "update" : "create"})`);
  if (!write) return;
  if (found)
    await apiRoot
      .extensions()
      .withKey({ key: EXTENSION })
      .post({
        body: {
          version: found.version,
          actions: [
            { action: "changeDestination", destination },
            { action: "changeTriggers", triggers },
          ],
        },
      })
      .execute();
  else
    await apiRoot
      .extensions()
      .post({ body: { key: EXTENSION, destination, triggers, timeoutInMs: 2000 } })
      .execute();
}

// ---------- Check ----------

async function check(slice: Slice) {
  const { body: channel } = await apiRoot.channels().withKey({ key: CHANNEL }).get().execute();
  const sample = [...slice.skus.filter((s) => slice.web(s).length > 1).slice(0, 2), ...slice.skus.slice(-1)];
  const list = sample.map((s) => `"${s}"`).join(", ");
  const { body } = await apiRoot
    .productProjections()
    .get({
      queryArgs: {
        where: `masterVariant(sku in (${list}))`,
        storeProjection: STORE,
        priceCurrency: CURRENCY,
        priceCountry: "NZ",
        priceChannel: channel.id,
      },
    })
    .execute();
  console.log("Price selection (store nz-trade, NZD, NZ, nz-trade-web):");
  for (const p of body.results) {
    const v = p.masterVariant;
    const tiers = (v.price?.tiers ?? []).map((t) => `${t.minimumQuantity}+ ${t.value.centAmount}`).join(", ");
    console.log(`  ${v.sku}: ${v.price ? `${v.price.value.centAmount} cents${tiers ? `, tiers ${tiers}` : ""}` : "NO PRICE"}`);
  }

  if (!(await missing(apiRoot.extensions().withKey({ key: EXTENSION }).get().execute())))
    return console.log("No extension registered: the cart check needs --extension first.");
  const sku = sample[0];
  const qty = slice.web(sku)[1]?.minQuantity ?? 2;
  console.log(`Carts with ${sku} (the extension sets each company's price; ${qty}+ is the first break):`);
  for (const code of COMPANIES) {
    const { body: customer } = await apiRoot
      .customers()
      .withKey({ key: buyerKey(code) })
      .get()
      .execute();
    let cart: Cart | undefined;
    try {
      const carts = apiRoot.inStoreKeyWithStoreKeyValue({ storeKey: STORE }).carts();
      cart = (
        await carts
          .post({
            body: {
              currency: CURRENCY,
              country: "NZ",
              customerId: customer.id,
              businessUnit: { typeId: "business-unit", key: code },
              lineItems: [{ sku, quantity: 1 }],
            },
          })
          .execute()
      ).body;
      const one = cart.lineItems[0];
      cart = (
        await carts
          .withId({ ID: cart.id })
          .post({ body: { version: cart.version, actions: [{ action: "changeLineItemQuantity", lineItemId: one.id, quantity: qty }] } })
          .execute()
      ).body;
      const many = cart.lineItems[0];
      const shown = (m: TypedMoney) => (m.type === "highPrecision" ? `${m.preciseAmount}/10^${m.fractionDigits}` : `${m.centAmount}c`);
      const expect1 = slice.ladderOf(code, sku)!;
      console.log(
        `  ${code}: 1 × ${shown(one.price.value)} (${one.priceMode}), ${qty} × ${shown(many.price.value)} (${many.priceMode}); ` +
          `price store ${expect1.map((s) => `${s.minQuantity}+ ${s.price}`).join(", ")}; web ${slice
            .web(sku)
            .map((s) => `${s.minQuantity}+ ${s.price}`)
            .join(", ")}`,
      );
    } finally {
      if (cart) {
        const { body: latest } = await apiRoot.carts().withId({ ID: cart.id }).get().execute();
        await apiRoot
          .carts()
          .withId({ ID: cart.id })
          .delete({ queryArgs: { version: latest.version } })
          .execute();
      }
    }
  }
  console.log("Temporary carts removed.");
}

// ---------- Remove ----------

async function remove(slice: Slice) {
  if (!write) return console.log("--remove deletes the NZ trade POC data: add --yes to run it.");
  const del = async (label: string, get: () => Promise<{ version: number } | undefined>, run: (version: number) => Promise<unknown>) => {
    const found = await get();
    if (!found) return;
    await run(found.version);
    console.log(`- ${label}`);
  };
  const byKey = <T extends { version: number }>(p: Promise<{ body: T }>) => missing(p.then((r) => r.body));

  await del(
    `extension ${EXTENSION}`,
    () => byKey(apiRoot.extensions().withKey({ key: EXTENSION }).get().execute()),
    (version) => apiRoot.extensions().withKey({ key: EXTENSION }).delete({ queryArgs: { version } }).execute(),
  );
  for (const code of COMPANIES) {
    await del(
      `business unit ${code}`,
      () => byKey(apiRoot.businessUnits().withKey({ key: code }).get().execute()),
      (version) => apiRoot.businessUnits().withKey({ key: code }).delete({ queryArgs: { version } }).execute(),
    );
  }
  for (const code of COMPANIES)
    await del(
      `customer ${buyerEmail(code)}`,
      () =>
        byKey(
          apiRoot
            .customers()
            .withKey({ key: buyerKey(code) })
            .get()
            .execute(),
        ),
      (version) =>
        apiRoot
          .customers()
          .withKey({ key: buyerKey(code) })
          .delete({ queryArgs: { version } })
          .execute(),
    );
  await del(
    `store ${STORE}`,
    () => byKey(apiRoot.stores().withKey({ key: STORE }).get().execute()),
    (version) => apiRoot.stores().withKey({ key: STORE }).delete({ queryArgs: { version } }).execute(),
  );
  await del(
    `product selection ${SELECTION}`,
    () => byKey(apiRoot.productSelections().withKey({ key: SELECTION }).get().execute()),
    (version) => apiRoot.productSelections().withKey({ key: SELECTION }).delete({ queryArgs: { version } }).execute(),
  );
  // Every product of the category, also SKUs a different --skus run created.
  const { body: category } = await apiRoot
    .categories()
    .withKey({ key: CATEGORY })
    .get()
    .execute()
    .catch(() => ({ body: undefined }));
  const { body: products } = category
    ? await apiRoot
        .products()
        .get({
          queryArgs: {
            where: `masterData(current(categories(id = "${category.id}")) or staged(categories(id = "${category.id}")))`,
            limit: 500,
          },
        })
        .execute()
    : { body: { results: [] } };
  for (const product of products.results) {
    const sku = product.masterData.staged.masterVariant.sku;
    if (sku)
      await del(
        `web price ${priceKeyOf(sku)}`,
        () =>
          byKey(
            apiRoot
              .standalonePrices()
              .withKey({ key: priceKeyOf(sku) })
              .get()
              .execute(),
          ),
        (version) =>
          apiRoot
            .standalonePrices()
            .withKey({ key: priceKeyOf(sku) })
            .delete({ queryArgs: { version } })
            .execute(),
      );
    let version = product.version;
    if (product.masterData.published)
      version = (
        await apiRoot
          .products()
          .withId({ ID: product.id })
          .post({ body: { version, actions: [{ action: "unpublish" }] } })
          .execute()
      ).body.version;
    await apiRoot.products().withId({ ID: product.id }).delete({ queryArgs: { version } }).execute();
    console.log(`- product ${product.key} ${sku ?? ""}`);
  }
  await del(
    `category ${CATEGORY}`,
    () => byKey(apiRoot.categories().withKey({ key: CATEGORY }).get().execute()),
    (version) => apiRoot.categories().withKey({ key: CATEGORY }).delete({ queryArgs: { version } }).execute(),
  );
  await del(
    `product type ${PRODUCT_TYPE}`,
    () => byKey(apiRoot.productTypes().withKey({ key: PRODUCT_TYPE }).get().execute()),
    (version) => apiRoot.productTypes().withKey({ key: PRODUCT_TYPE }).delete({ queryArgs: { version } }).execute(),
  );
  await del(
    `shipping method ${SHIPPING}`,
    () => byKey(apiRoot.shippingMethods().withKey({ key: SHIPPING }).get().execute()),
    (version) => apiRoot.shippingMethods().withKey({ key: SHIPPING }).delete({ queryArgs: { version } }).execute(),
  );
  await del(
    `zone ${ZONE}`,
    () => byKey(apiRoot.zones().withKey({ key: ZONE }).get().execute()),
    (version) => apiRoot.zones().withKey({ key: ZONE }).delete({ queryArgs: { version } }).execute(),
  );
  await del(
    `tax category ${TAX}`,
    () => byKey(apiRoot.taxCategories().withKey({ key: TAX }).get().execute()),
    (version) => apiRoot.taxCategories().withKey({ key: TAX }).delete({ queryArgs: { version } }).execute(),
  );
  await del(
    `channel ${CHANNEL}`,
    () => byKey(apiRoot.channels().withKey({ key: CHANNEL }).get().execute()),
    (version) => apiRoot.channels().withKey({ key: CHANNEL }).delete({ queryArgs: { version } }).execute(),
  );
  const keys = await companyKeys(COMPANIES);
  await writeLadderFields({}, keys);
  console.log(`- ${keys.length} company prices from ${priceStoreName()}`);
  void slice;
}

async function main() {
  const slice = readSlice();
  console.log(`NZ trade slice: ${COMPANIES.length} companies (${COMPANIES.join(", ")}), ${slice.skus.length} SKUs`);
  if (args.includes("--remove")) return remove(slice);
  if (args.includes("--check")) return check(slice);
  if (args.includes("--prices")) return syncPrices(slice);
  if (args.includes("--extension")) return registerExtension();
  if (args.includes("--units")) return setupUnits();
  return setupCatalog(slice);
}

main().catch((err) => {
  console.error(err?.body ?? err);
  process.exit(1);
});
