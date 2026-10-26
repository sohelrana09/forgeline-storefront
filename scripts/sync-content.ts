// Pushes content/blocks/*.json and content/pages/*.json into commercetools Custom Objects.
// Idempotent: unchanged entries are skipped; the file name (without .json) is the key.
//   npm run ct:content                        sync all
//   npm run ct:content -- --prune             also LIST objects that no longer have a file (dry run)
//   npm run ct:content -- --prune --yes       …and delete them
// After a change it asks the storefront (SITE_URL) to refresh its cached guest pages, when REVALIDATE_SECRET is set.
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isDeepStrictEqual } from "node:util";
import type { CustomObject } from "@commercetools/platform-sdk";
import { apiRoot } from "../src/lib/commercetools/client";
import { BLOCK_CONTAINER, PAGE_CONTAINER, PLACEMENTS } from "../src/features/cms/types";
import { isMediaUrl, MEDIA_SOURCES } from "../src/lib/media";

// Resolved from this file, not the working directory, so running it from elsewhere can't sync (or prune) an empty set.
const CONTENT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "content");
const KEY = /^[a-z0-9-]+$/;
const SKU = /^[A-Za-z0-9._-]+$/;
const isStringArray = (v: unknown) => Array.isArray(v) && v.every((x) => typeof x === "string");
const statusOf = (err: unknown) => (err as { body?: { statusCode?: number } })?.body?.statusCode;
let changed = 0;

async function allObjects(container: string): Promise<CustomObject[]> {
  const out: CustomObject[] = [];
  for (let offset = 0; ; offset += 500) {
    const { body } = await apiRoot
      .customObjects()
      .withContainer({ container })
      .get({ queryArgs: { limit: 500, offset } })
      .execute();
    out.push(...body.results);
    if (out.length >= (body.total ?? 0) || body.results.length === 0) return out;
  }
}

async function sync(dir: string, container: string, validate: (key: string, value: Record<string, unknown>) => void) {
  const files = (await readdir(dir)).filter((f) => f.endsWith(".json"));
  const existing = await allObjects(container);

  for (const file of files) {
    const key = path.basename(file, ".json");
    if (!KEY.test(key)) throw new Error(`${file}: file names must be lowercase letters, digits and dashes`);
    const value = JSON.parse(await readFile(path.join(dir, file), "utf8"));
    validate(key, value);
    const current = existing.find((o) => o.key === key);
    if (current && isDeepStrictEqual(current.value, value)) {
      console.log(`= ${container}/${key}`);
      continue;
    }
    await apiRoot
      .customObjects()
      .post({ body: { container, key, value, ...(current && { version: current.version }) } })
      .execute();
    changed += 1;
    console.log(`${current ? "~" : "+"} ${container}/${key}`);
  }

  if (!process.argv.includes("--prune")) return;
  if (files.length === 0) throw new Error(`Refusing to prune ${container}: no content files found in ${dir}`);
  const orphans = existing.filter((o) => !files.includes(`${o.key}.json`));
  for (const o of orphans) {
    if (!process.argv.includes("--yes")) {
      console.log(`? ${container}/${o.key} has no file (would delete; re-run with --prune --yes)`);
      continue;
    }
    const remove = (version: number) =>
      apiRoot.customObjects().withContainerAndKey({ container, key: o.key }).delete({ queryArgs: { version } }).execute();
    await remove(o.version).catch(async (err) => {
      if (statusOf(err) !== 409) throw err;
      const { body } = await apiRoot.customObjects().withContainerAndKey({ container, key: o.key }).get().execute();
      await remove(body.version);
    });
    changed += 1;
    console.log(`- ${container}/${o.key}`);
  }
}

function validateBlock(key: string, v: Record<string, unknown>) {
  const fail = (msg: string) => {
    throw new Error(`block ${key}: ${msg}`);
  };
  if (typeof v.active !== "boolean") fail(`"active" must be true or false`);
  if (!PLACEMENTS.includes(v.placement as never)) fail(`unknown placement "${v.placement}" (allowed: ${PLACEMENTS.join(", ")})`);
  if (v.type === "products") {
    if (!isStringArray(v.skus) || !(v.skus as string[]).every((s) => SKU.test(s))) fail(`products blocks need "skus": [sku, …]`);
  } else if (v.type === "markdown") {
    if (typeof v.content !== "string") fail(`markdown blocks need "content"`);
  } else if (v.type === "banner") {
    if (typeof v.headline !== "string" || !v.headline.trim()) fail(`banner blocks need a "headline"`);
    if (!isMediaUrl(v.image))
      fail(`banner "image" must be a URL from the media library (${MEDIA_SOURCES.map((s) => `https://${s.host}${s.path}`).join(" or ")})`);
    if (v.mobileImage !== undefined && !isMediaUrl(v.mobileImage)) fail(`banner "mobileImage" must be a media library URL`);
    if (v.theme !== undefined && v.theme !== "dark" && v.theme !== "light") fail(`banner "theme" must be "dark" or "light"`);
    checkCta(v.secondaryCta, "secondaryCta", fail);
  } else fail(`"type" must be "markdown", "products" or "banner"`);
  for (const field of ["startsAt", "endsAt"] as const) {
    if (v[field] !== undefined && (typeof v[field] !== "string" || Number.isNaN(Date.parse(v[field] as string)))) {
      fail(`"${field}" must be a date and time such as "2026-11-01T00:00:00Z"`);
    }
  }
  if (v.stores !== undefined && !isStringArray(v.stores)) fail(`"stores" must be a list of store keys`);
  if (v.categories !== undefined && !isStringArray(v.categories)) fail(`"categories" must be a list of category slugs`);
  checkCta(v.cta, "cta", fail);
}

function checkCta(value: unknown, name: string, fail: (msg: string) => void) {
  const cta = value as { label?: unknown; href?: unknown } | undefined;
  if (cta && (typeof cta.label !== "string" || typeof cta.href !== "string" || !/^(\/(?!\/)|https:)/.test(cta.href))) {
    fail(`"${name}" needs a "label" and an "href" starting with "/" or "https:"`);
  }
}

function validatePage(key: string, v: Record<string, unknown>) {
  if (typeof v.title !== "string" || typeof v.content !== "string") throw new Error(`page ${key}: needs "title" and "content"`);
  if (typeof v.active !== "boolean") throw new Error(`page ${key}: "active" must be true or false`);
}

// Guests see cached pages (src/app/(cached)/g): tell the storefront to refresh them. Content is saved either way, so
// a failure here only warns (guests then see the change within 5 minutes).
async function refreshStorefront() {
  const secret = process.env.REVALIDATE_SECRET;
  const site = (process.env.SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
  if (!secret) {
    console.log("Set REVALIDATE_SECRET to refresh the storefront's cached pages now (otherwise within 5 minutes).");
    return;
  }
  try {
    const res = await fetch(`${site}/api/revalidate`, {
      method: "POST",
      headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" },
      body: JSON.stringify({ scope: "content" }),
    });
    console.log(res.ok ? `Refreshed cached pages on ${site}` : `Storefront refresh failed: ${res.status} from ${site}`);
  } catch (err) {
    console.log(`Storefront refresh failed (${site} unreachable): ${(err as Error).message}`);
  }
}

async function main() {
  await sync(path.join(CONTENT_ROOT, "blocks"), BLOCK_CONTAINER, validateBlock);
  await sync(path.join(CONTENT_ROOT, "pages"), PAGE_CONTAINER, validatePage);
  if (changed > 0) await refreshStorefront();
}

main().catch((err) => {
  console.error(err?.body ?? err.message ?? err);
  process.exit(1);
});
