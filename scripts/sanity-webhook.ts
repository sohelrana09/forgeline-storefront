// Prints a link that opens Sanity's "create webhook" form, filled in for this storefront: every publish, change or
// delete of a page, block, post, author or blog category calls POST <SITE_URL>/api/revalidate with { "scope": "content" },
// so guests see the change at once instead of within a minute.
//   npm run ct:sanity-webhook                       for SITE_URL
//   npm run ct:sanity-webhook -- --site https://…   another deployment
// Read-only: you create the webhook in Sanity's form. The secret is NOT in the link (it would end up in the browser
// history): add the header `Authorization: Bearer <REVALIDATE_SECRET>` in the form before saving.
import { sanityConfigured, sanityProjectId } from "../src/lib/sanity/env";

const args = process.argv.slice(2);
const flag = (name: string) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};

// The document types the storefront reads (src/studio/schemaTypes/documents.ts).
const TYPES = ["page", "cmsBlock", "post", "author", "blogCategory"];

async function main() {
  if (!sanityConfigured) throw new Error("Set NEXT_SANITY_PROJECT_ID first.");
  const site = (flag("--site") ?? process.env.SITE_URL ?? "").replace(/\/$/, "");
  if (!/^https:\/\//.test(site)) throw new Error("Sanity can only call a public https URL: set SITE_URL or pass --site https://….");

  const params = new URLSearchParams({
    name: "Storefront cache refresh",
    description: `Refreshes the cached guest pages of ${site} after content changes`,
    url: `${site}/api/revalidate`,
    filter: `_type in [${TYPES.map((t) => `"${t}"`).join(", ")}]`,
    projection: `{"scope": "content"}`,
    httpMethod: "POST",
    apiVersion: "v2021-03-25",
    includeDrafts: "false",
  });
  for (const on of ["create", "update", "delete"]) params.append("on", on);

  console.log(`Open this link signed in to sanity.io (project ${sanityProjectId}):\n`);
  console.log(`https://www.sanity.io/manage/webhooks/share?${params}\n`);
  console.log("In the form: pick the project and dataset, add the HTTP header");
  console.log("  Authorization: Bearer <your REVALIDATE_SECRET>");
  console.log('then save. Check it: publish a page in /studio; the attempt log shows 200 {"revalidated":true}.');
}

main().catch((err) => {
  console.error(err?.body ?? err?.message ?? err);
  process.exit(1);
});
