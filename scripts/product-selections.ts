// Company assortments with commercetools Product Selections (docs/features/product-selections.md).
//   npm run ct:product-selections                       stores and their selections (with product counts)
//   npm run ct:product-selections -- --key <selection key> --name "<name>" (--file skus.txt | --skus a,b) [--store <store key>] [--yes]
//        creates the selection or makes it hold exactly those products, and assigns it to the store (active)
//   npm run ct:product-selections -- --remove <selection key> --store <store key> [--yes]
//        takes it off the store (the selection itself stays; delete it in Merchant Center)
// Dry run without --yes. Needs an API client with manage_product_selections and manage_stores (the storefront
// itself only needs its usual scopes: every catalog read passes storeProjection, so it follows the selection).
// Careful: a store with only individual selections shows ONLY their products. Check with --check <store> <sku>.
import { readFileSync } from "node:fs";
import type { ProductSelection, Store } from "@commercetools/platform-sdk";
import { apiRoot } from "../src/lib/commercetools/client";
import { assignActions, parseSkuList, selectionActions, unassignActions } from "../src/features/product-selections/plan";

const args = process.argv.slice(2);
const yes = args.includes("--yes");
const one = (name: string) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};
const statusOf = (err: unknown) => (err as { body?: { statusCode?: number } })?.body?.statusCode;
const selections = () => apiRoot.productSelections();

async function productIds(selection: ProductSelection): Promise<string[]> {
  const ids: string[] = [];
  for (let offset = 0; ; offset += 500) {
    const { body } = await selections()
      .withId({ ID: selection.id })
      .products()
      .get({ queryArgs: { limit: 500, offset } })
      .execute();
    ids.push(...body.results.map((r) => r.product.id));
    if (body.results.length < 500) return ids;
  }
}

async function list() {
  const { body } = await apiRoot
    .stores()
    .get({ queryArgs: { limit: 100, expand: ["productSelections[*].productSelection"] } })
    .execute();
  for (const store of body.results) {
    const rows = (store.productSelections ?? []).map((s) => {
      const ps = s.productSelection.obj;
      return `${ps?.key ?? s.productSelection.id} (${ps?.mode ?? "?"}, ${ps?.productCount ?? "?"} products${s.active ? "" : ", inactive"})`;
    });
    console.log(`${store.key}: ${rows.length ? rows.join("; ") : "no selections (sells the whole catalog)"}`);
  }
}

async function check(storeKey: string, sku: string) {
  const { body } = await apiRoot
    .productProjections()
    .get({ queryArgs: { where: `masterVariant(sku = "${sku}") or variants(sku = "${sku}")`, storeProjection: storeKey, limit: 1 } })
    .execute();
  console.log(body.results.length ? `= ${sku} is in ${storeKey}'s assortment` : `- ${sku} is NOT in ${storeKey}'s assortment`);
}

async function idsForSkus(skus: string[]): Promise<{ ids: string[]; missing: string[] }> {
  const ids = new Set<string>();
  const found = new Set<string>();
  for (let i = 0; i < skus.length; i += 100) {
    const list = skus
      .slice(i, i + 100)
      .map((s) => `"${s}"`)
      .join(", ");
    const { body } = await apiRoot
      .productProjections()
      .get({ queryArgs: { where: `masterVariant(sku in (${list})) or variants(sku in (${list}))`, limit: 500 } })
      .execute();
    for (const p of body.results) {
      ids.add(p.id);
      for (const v of [p.masterVariant, ...p.variants]) if (v.sku) found.add(v.sku);
    }
  }
  return { ids: [...ids], missing: skus.filter((s) => !found.has(s)) };
}

async function store(key: string): Promise<Store> {
  return (await apiRoot.stores().withKey({ key }).get().execute()).body;
}

async function save() {
  const key = one("--key")!;
  const name = one("--name") ?? key;
  const source = one("--file") ? readFileSync(one("--file")!, "utf8") : (one("--skus") ?? "").split(",").join("\n");
  const { skus, invalid } = parseSkuList(source);
  if (invalid.length) console.log(`! ignored invalid SKUs: ${invalid.join(", ")}`);
  if (skus.length === 0) throw new Error("No SKUs: pass --file or --skus");
  const { ids, missing } = await idsForSkus(skus);
  if (missing.length) console.log(`! unknown SKUs: ${missing.join(", ")}`);
  const existing = await selections()
    .withKey({ key })
    .get()
    .execute()
    .then((r) => r.body)
    .catch((err) => (statusOf(err) === 404 ? undefined : Promise.reject(err)));
  const actions = existing ? selectionActions(await productIds(existing), ids) : [];
  const adds = existing ? actions.filter((a) => a.action === "addProduct").length : ids.length;
  const removes = actions.filter((a) => a.action === "removeProduct").length;
  console.log(
    `${existing ? "~" : "+"} selection ${key}: ${existing ? "" : "create, "}${adds} to add, ${removes} to remove (${ids.length} products from ${skus.length} SKUs)`,
  );
  let selection = existing;
  if (yes) {
    if (!existing) {
      selection = (
        await selections()
          .post({ body: { key, name: { "en-US": name }, mode: "Individual" } })
          .execute()
      ).body;
      actions.push(...selectionActions([], ids));
    }
    for (let i = 0; i < actions.length; i += 100) {
      selection = (
        await selections()
          .withId({ ID: selection!.id })
          .post({ body: { version: selection!.version, actions: actions.slice(i, i + 100) } })
          .execute()
      ).body;
    }
  }
  const storeKey = one("--store");
  if (storeKey) {
    const s = await store(storeKey);
    const assign = selection ? assignActions(s.productSelections, key, selection.id) : [{ action: "addProductSelection" }];
    if (assign.length === 0) console.log(`= ${storeKey} already uses ${key}`);
    else if (!yes)
      console.log(
        `+ would assign ${key} to ${storeKey}${(s.productSelections ?? []).length ? "" : " (its first selection: the store then sells ONLY these products)"}`,
      );
    else {
      await apiRoot
        .stores()
        .withKey({ key: storeKey })
        .post({ body: { version: s.version, actions: assignActions(s.productSelections, key, selection!.id) } })
        .execute();
      console.log(`+ assigned ${key} to ${storeKey}`);
    }
  }
  if (!yes) console.log("Dry run: add --yes to apply.");
}

async function remove(key: string) {
  const storeKey = one("--store");
  if (!storeKey) throw new Error("--remove needs --store");
  const selection = (await selections().withKey({ key }).get().execute()).body;
  const s = await store(storeKey);
  const actions = unassignActions(s.productSelections, key, selection.id);
  if (actions.length === 0) return console.log(`= ${storeKey} doesn't use ${key}`);
  if (!yes) return console.log(`- would take ${key} off ${storeKey}`);
  await apiRoot
    .stores()
    .withKey({ key: storeKey })
    .post({ body: { version: s.version, actions } })
    .execute();
  console.log(`- took ${key} off ${storeKey}`);
}

const checkAt = args.indexOf("--check");
const run =
  checkAt >= 0 ? check(args[checkAt + 1], args[checkAt + 2]) : one("--remove") ? remove(one("--remove")!) : one("--key") ? save() : list();
run.catch((err) => {
  if (statusOf(err) === 403)
    console.error(
      "The API client lacks a scope: this script needs manage_product_selections and manage_stores (view_product_selections to list).",
    );
  console.error((err as { body?: { message?: string } })?.body?.message ?? (err as Error).message);
  process.exit(1);
});
