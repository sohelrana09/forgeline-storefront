// Adds a demo blog to Sanity (an author, two categories and a post with commercetools product cards).
//   npm run ct:sanity-content                  dry run: lists what would be created
//   npm run ct:sanity-content -- --yes         creates what's missing
// Idempotent: documents have fixed ids and are only created when missing, so edits made in the Studio are never
// overwritten. Needs NEXT_SANITY_PROJECT_ID and SANITY_API_WRITE_TOKEN (an Editor token) in .env.
import { randomUUID } from "node:crypto";
import { createClient } from "next-sanity";
import { sanityApiVersion, sanityConfigured, sanityDataset, sanityProjectId } from "../src/lib/sanity/env";

const args = process.argv.slice(2);
const yes = args.includes("--yes");

type Doc = { _id: string; _type: string; [field: string]: unknown };
const key = () => randomUUID().slice(0, 12);
const text = (t: string, style = "normal") => ({
  _type: "block",
  _key: key(),
  style,
  markDefs: [],
  children: [{ _type: "span", _key: key(), text: t, marks: [] }],
});
const product = (sku: string) => ({ _type: "ctProduct", _key: key(), sku });

function demoBlog(): Doc[] {
  const ref = (id: string) => ({ _type: "reference", _ref: id, _key: key() });
  return [
    { _id: "author-ironline-team", _type: "author", name: "Ironline Supply team", role: "Service and parts" },
    {
      _id: "blog-category-maintenance",
      _type: "blogCategory",
      title: "Maintenance",
      slug: { _type: "slug", current: "maintenance" },
      description: "Keep machines running: service intervals, parts and checklists.",
    },
    {
      _id: "blog-category-buying-guides",
      _type: "blogCategory",
      title: "Buying guides",
      slug: { _type: "slug", current: "buying-guides" },
      description: "How to choose machines and parts for the job.",
    },
    {
      _id: "post-filter-service-checklist",
      _type: "post",
      title: "The filter service checklist for heavy machines",
      slug: { _type: "slug", current: "filter-service-checklist" },
      publishedAt: new Date().toISOString(),
      excerpt: "Air, fuel and oil filters decide how long an engine lasts. Here is when to change each one, and what to keep in stock.",
      author: { _type: "reference", _ref: "author-ironline-team" },
      categories: [ref("blog-category-maintenance")],
      tags: ["filters", "service", "engines"],
      body: [
        text("Why filters matter", "h2"),
        text(
          "Most engine wear starts with dirt: dust through the air intake, water in the fuel, metal in the oil. Filters are the cheapest part of a machine and protect the most expensive one.",
        ),
        text("When to change them", "h2"),
        text(
          "Air filters: every 250 to 500 operating hours, sooner on dusty sites. Fuel filters: every 500 hours or at every second oil change. Oil filters: with every oil change.",
        ),
        {
          _type: "productCards",
          _key: key(),
          title: "Filters we keep in stock",
          products: [product("air-filter"), product("fuel-filter"), product("oil-filter")],
        },
        text("Check the hoses too", "h2"),
        text(
          "While the covers are off, look at the hydraulic hoses for cracks and wet spots. A burst hose stops the machine just like a clogged filter.",
        ),
      ],
      products: [product("hydraulic-hose")],
      seo: { _type: "seo", description: "When to change air, fuel and oil filters on heavy machines, and which ones to keep in stock." },
    },
  ];
}

async function main() {
  if (!sanityConfigured) throw new Error("Set NEXT_SANITY_PROJECT_ID (and SANITY_API_WRITE_TOKEN) in .env first.");
  const token = process.env.SANITY_API_WRITE_TOKEN;
  if (yes && !token) throw new Error("SANITY_API_WRITE_TOKEN is not set: create an Editor token in sanity.io/manage → API → Tokens.");
  const client = createClient({ projectId: sanityProjectId, dataset: sanityDataset, apiVersion: sanityApiVersion, useCdn: false, token });

  const docs = demoBlog();
  const existing = new Set(await client.fetch<string[]>(`*[_id in $ids]._id`, { ids: docs.map((d) => d._id) }));
  const missing = docs.filter((d) => !existing.has(d._id));
  for (const d of docs) console.log(`${existing.has(d._id) ? "= exists " : yes ? "+ create " : "+ would create"} ${d._type} ${d._id}`);
  if (missing.length === 0) return console.log("Nothing to do.");
  if (!yes) return console.log(`Dry run: add --yes to create ${missing.length} documents.`);
  const tx = client.transaction();
  for (const d of missing) tx.createIfNotExists(d);
  await tx.commit();
  console.log(
    `Created ${missing.length} published documents. Edit them in the Studio at /studio; the storefront shows them within a minute.`,
  );
}

main().catch((err) => {
  console.error(err?.body ?? err?.message ?? err);
  process.exit(1);
});
