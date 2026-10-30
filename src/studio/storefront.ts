// The storefront's address for the Studio's preview pane and pickers (products, categories). Empty when the Studio is
// embedded in the storefront (same origin, relative URLs); a standalone Studio (`sanity deploy`) sets
// SANITY_STUDIO_STOREFRONT_URL, which the Sanity CLI builds in. The storefront answers its requests through CORS for
// STUDIO_URL only (src/lib/cors.ts).
export const storefrontUrl = (process.env.SANITY_STUDIO_STOREFRONT_URL ?? "").replace(/\/+$/, "");
