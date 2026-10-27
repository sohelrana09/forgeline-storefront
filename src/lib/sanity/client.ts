import "server-only";
import { createClient } from "next-sanity";
import { draftMode } from "next/headers";
import { staleWhileRevalidate } from "@/lib/memo";
import { sanityApiVersion, sanityConfigured, sanityDataset, sanityProjectId, STUDIO_PATH } from "@/lib/sanity/env";

// Reads from Sanity. Published content goes through the per-process memo (60 s, cleared by
// /api/revalidate when Sanity's webhook reports a publish). In draft mode (the Studio's Presentation preview) reads
// bypass every cache, see drafts through the Viewer token and carry stega markers for click-to-edit; those results
// are never memoized, so a preview can't leak a draft to visitors.
const client = createClient({
  projectId: sanityProjectId || "unset",
  dataset: sanityDataset,
  apiVersion: sanityApiVersion,
  // Not the API CDN: it can answer from a few seconds before a publish, and the memo would then keep that stale
  // answer after the webhook's refresh. The memo already limits reads to about one per query per minute.
  useCdn: false,
  perspective: "published",
  stega: { enabled: false, studioUrl: STUDIO_PATH },
});

const memo = staleWhileRevalidate<unknown>(60 * 1000);
export const forgetSanityCache = () => memo.clear();

// Draft mode is a request cookie; outside a request (scripts, build) it's off.
export async function isDraftMode() {
  try {
    return (await draftMode()).isEnabled;
  } catch {
    return false;
  }
}

const readToken = () => {
  const token = process.env.SANITY_API_READ_TOKEN;
  if (!token) throw new Error("SANITY_API_READ_TOKEN is not set: draft preview needs a Viewer token");
  return token;
};

// For the draft-mode enable route, which checks the Presentation tool's secret with this token.
export const previewClient = () => client.withConfig({ token: readToken(), useCdn: false });

type Params = Record<string, string | number | boolean | string[]>;

// `drafts: false` for data that is shared between visitors (URL index, sitemap, footer): always published.
export async function sanityFetch<T>(query: string, params: Params = {}, { drafts = true } = {}): Promise<T> {
  if (!sanityConfigured) throw new Error("Sanity is not configured (NEXT_SANITY_PROJECT_ID)");
  if (drafts && (await isDraftMode())) {
    return client.fetch<T>(query, params, {
      perspective: "drafts",
      useCdn: false,
      token: readToken(),
      stega: true,
      cache: "no-store",
    });
  }
  // No `cache: "no-store"` here: it would mark the cached guest pages ((cached)/g, dynamic = "error") as dynamic and
  // fail their render. A plain fetch is allowed there (like the commercetools SDK's); the memo does the caching.
  return memo(`${query}\n${JSON.stringify(params)}`, () => client.fetch<T>(query, params)) as Promise<T>;
}
