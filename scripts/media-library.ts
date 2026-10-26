// Media library for CMS images (banners, pictures in Markdown). commercetools has no general file store, but its
// product image upload puts files on the commercetools CDN. Uploads go to one hidden product that is never
// published, so it never shows in the shop: product type "cms-media", product "cms-media-library".
// Idempotent: creates what's missing, changes nothing else.
//   npm run ct:media-library                       ensure the product exists, list its images
//   npm run ct:media-library -- --upload <file>    upload one image (jpeg, png, gif) and print its URL
import { readFile } from "node:fs/promises";
import path from "node:path";
import { apiRoot } from "../src/lib/commercetools/client";
import { MEDIA_PRODUCT_KEY, MEDIA_PRODUCT_TYPE_KEY, MEDIA_SKU } from "../src/features/cms/types";

// The only formats the commercetools image upload accepts.
const TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
};
const statusOf = (err: unknown) => (err as { body?: { statusCode?: number } })?.body?.statusCode;

async function ensureProductType() {
  const found = await apiRoot
    .productTypes()
    .withKey({ key: MEDIA_PRODUCT_TYPE_KEY })
    .get()
    .execute()
    .then((r) => r.body)
    .catch((err) => (statusOf(err) === 404 ? undefined : Promise.reject(err)));
  if (found) return found;
  const { body } = await apiRoot
    .productTypes()
    .post({
      body: {
        key: MEDIA_PRODUCT_TYPE_KEY,
        name: "CMS media",
        description: "Holds CMS images on the commercetools CDN. Never published.",
        attributes: [],
      },
    })
    .execute();
  console.log(`+ product type ${MEDIA_PRODUCT_TYPE_KEY}`);
  return body;
}

async function ensureProduct() {
  const found = await apiRoot
    .products()
    .withKey({ key: MEDIA_PRODUCT_KEY })
    .get()
    .execute()
    .then((r) => r.body)
    .catch((err) => (statusOf(err) === 404 ? undefined : Promise.reject(err)));
  if (found) return found;
  await ensureProductType();
  const { body } = await apiRoot
    .products()
    .post({
      body: {
        key: MEDIA_PRODUCT_KEY,
        productType: { typeId: "product-type", key: MEDIA_PRODUCT_TYPE_KEY },
        name: { "en-GB": "CMS media library (do not publish)" },
        slug: { "en-GB": MEDIA_PRODUCT_KEY },
        masterVariant: { sku: MEDIA_SKU },
        publish: false,
      },
    })
    .execute();
  console.log(`+ product ${MEDIA_PRODUCT_KEY} (unpublished)`);
  return body;
}

async function main() {
  const args = process.argv.slice(2);
  const product = await ensureProduct();
  const file = args[args.indexOf("--upload") + 1];
  if (args.includes("--upload")) {
    const type = TYPES[path.extname(file ?? "").toLowerCase()];
    if (!file || !type) throw new Error("--upload needs a .jpg, .png or .gif file");
    const { body } = await apiRoot
      .products()
      .withId({ ID: product.id })
      .images()
      .post({
        body: await readFile(file),
        headers: { "Content-Type": type },
        queryArgs: { sku: MEDIA_SKU, filename: path.basename(file).replace(/[^A-Za-z0-9._-]/g, "-"), staged: true },
      })
      .execute();
    // commercetools appends a random suffix to the file name: find ours by its stem (another upload may have
    // landed at the same time, so "the last image" isn't reliable).
    const stem = path.basename(file, path.extname(file)).replace(/[^A-Za-z0-9._-]/g, "-");
    const images = body.masterData.staged.masterVariant.images ?? [];
    const added = images.filter((img) => img.url.split("/").pop()?.startsWith(`${stem}-`)).pop() ?? images[images.length - 1];
    console.log(`+ ${added.url} (${added.dimensions.w} × ${added.dimensions.h})`);
    return;
  }
  const images = product.masterData.staged.masterVariant.images ?? [];
  console.log(`= ${MEDIA_PRODUCT_KEY}: ${images.length} image(s)`);
  for (const img of images) console.log(`  ${img.url} (${img.dimensions.w} × ${img.dimensions.h})`);
}

main().catch((err) => {
  console.error(err?.body ?? err);
  process.exit(1);
});
