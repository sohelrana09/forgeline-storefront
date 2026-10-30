import "server-only";
import { createClient } from "next-sanity";
import { draftMode } from "next/headers";
import { cacheFor, TAGS } from "@/lib/cache";
import { sanityApiVersion, sanityConfigured, sanityDataset, sanityProjectId, STUDIO_PATH } from "@/lib/sanity/env";

// Reads from Sanity. Published content is cached and shared ("use cache", 60 s, cleared by /api/revalidate when
// Sanity's webhook reports a publish). In draft mode (the Studio's Presentation preview) reads bypass every cache, see
// drafts through the Viewer token and carry stega markers for click-to-edit; those results are never cached, so a
// preview can't leak a draft to visitors.
const client = createClient({
  projectId: sanityProjectId || "unset",
  dataset: sanityDataset,
  apiVersion: sanityApiVersion,
  // Not the API CDN: it can answer from a few seconds before a publish, and the cache would then keep that stale
  // answer after the webhook's refresh. The cache already limits reads to about one per query per minute.
  useCdn: false,
  perspective: "published",
  stega: { enabled: false, studioUrl: STUDIO_PATH },
});

// Draft mode is a request cookie; outside Next (tsx scripts) it's off. Inside Next this is request data, so only
// streamed parts of a page (inside <Suspense>) may ask; never catch its errors, Next uses them to stop a prerender.
export async function isDraftMode() {
  if (!process.env.NEXT_RUNTIME) return false;
  return (await draftMode()).isEnabled;
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
  return publishedFetch<T>(query, params);
}

async function publishedFetch<T>(query: string, params: Params): Promise<T> {
  "use cache: remote";
  cacheFor("content", TAGS.content);
  return client.fetch<T>(query, params);
}
