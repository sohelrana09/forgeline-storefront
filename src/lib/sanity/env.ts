// Sanity project settings, read on the server only (NEXT_SANITY_*, not NEXT_PUBLIC_*: nothing is inlined into the
// browser bundle). The embedded Studio gets them as props from its server page (src/app/studio).
// Content pages and the blog come from Sanity once NEXT_SANITY_PROJECT_ID is set; until then both are off.
export const sanityProjectId = process.env.NEXT_SANITY_PROJECT_ID ?? "";
export const sanityDataset = process.env.NEXT_SANITY_DATASET || "production";
export const sanityApiVersion = "2026-10-01";
export const sanityConfigured = /^[a-z0-9]+$/.test(sanityProjectId);

// The Studio is embedded in this app (src/app/studio); Presentation previews the storefront from the same origin.
export const STUDIO_PATH = "/studio";
