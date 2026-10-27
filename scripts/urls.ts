// Storefront URLs: list every URL, the redirects and any clashes, or manage
// merchants' own redirects (a retired product to its successor, a campaign URL, an old site's URL).
//   npm run ct:urls                                  table of all URLs, redirects and clashes
//   npm run ct:urls -- --add /old-path /new-path [--temporary] [--yes]   add or change a redirect (301; 302 with --temporary)
//   npm run ct:urls -- --remove /old-path [--yes]                        remove a redirect
// Without --yes nothing is written. The storefront picks changes up within 5 minutes, or at once via /api/revalidate.
import { randomUUID } from "node:crypto";
import { apiRoot } from "../src/lib/commercetools/client";
import { normalizePath } from "../src/lib/urls";
import { buildUrlIndex } from "../src/features/urls/url-index";
import { REWRITE_CONTAINER, urlSources, type UrlRewrite } from "../src/features/urls/service";

const args = process.argv.slice(2);
const yes = args.includes("--yes");
const option = (name: string) => {
  const i = args.indexOf(name);
  return i >= 0 ? args.slice(i + 1).filter((a) => !a.startsWith("--")) : undefined;
};
const PATH = /^\/[a-z0-9/_-]{1,200}$/;

async function rewrites() {
  const { body } = await apiRoot
    .customObjects()
    .withContainer({ container: REWRITE_CONTAINER })
    .get({ queryArgs: { limit: 500 } })
    .execute();
  return body.results.map((o) => ({ key: o.key, version: o.version, value: o.value as UrlRewrite }));
}

async function main() {
  const add = option("--add");
  const remove = option("--remove");

  if (add) {
    const [from, to] = (add as string[]).map(normalizePath);
    if (!from || !to || !PATH.test(from) || !PATH.test(to) || from === to) throw new Error("Usage: --add /old-path /new-path");
    const existing = (await rewrites()).find((r) => normalizePath(r.value.from) === from);
    const value: UrlRewrite = { from, to, permanent: !args.includes("--temporary") };
    console.log(`${existing ? "Change" : "Add"} redirect ${from} -> ${to} (${value.permanent ? "301" : "302"})`);
    if (!yes) return console.log("Dry run: add --yes to save it.");
    await apiRoot
      .customObjects()
      .post({
        body: { container: REWRITE_CONTAINER, key: existing?.key ?? randomUUID(), value, ...(existing && { version: existing.version }) },
      })
      .execute();
    return console.log("Saved. The storefront uses it within 5 minutes (or at once after POST /api/revalidate).");
  }

  if (remove) {
    const from = normalizePath((remove as string[])[0] ?? "");
    const existing = (await rewrites()).find((r) => normalizePath(r.value.from) === from);
    if (!existing) return console.log(`No redirect from ${from}.`);
    console.log(`Remove redirect ${from} -> ${existing.value.to}`);
    if (!yes) return console.log("Dry run: add --yes to remove it.");
    await apiRoot
      .customObjects()
      .withContainerAndKey({ container: REWRITE_CONTAINER, key: existing.key })
      .delete({ queryArgs: { version: existing.version } })
      .execute();
    return console.log("Removed.");
  }

  const index = buildUrlIndex(await urlSources());
  const rows = [...index.paths].map(([path, t]) => ({
    path,
    shows: t.kind === "redirect" ? `${t.permanent ? "301" : "302"} -> ${t.to}` : `${t.kind}: ${t.slug}`,
  }));
  const pages = rows.filter((r) => !r.shows.startsWith("30"));
  console.log(`\nURLs (${pages.length}):`);
  console.table(pages.sort((a, b) => a.path.localeCompare(b.path)));
  console.log(`Redirects: ${rows.length - pages.length} (old /c/, /p/, /pages/ URLs, underscore spellings, merchants' redirects)`);
  const custom = await rewrites();
  if (custom.length > 0)
    console.table(custom.map((r) => ({ from: r.value.from, to: r.value.to, type: r.value.permanent === false ? "302" : "301" })));
  if (index.conflicts.length > 0) {
    console.log(`\nClashes (${index.conflicts.length}): fix the slug in Merchant Center or add a redirect.`);
    console.table(index.conflicts);
  } else console.log("No clashes.");
}

main().catch((err) => {
  console.error(err?.body ?? err);
  process.exit(1);
});
