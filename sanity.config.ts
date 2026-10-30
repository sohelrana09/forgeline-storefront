import { studioConfig } from "./src/studio/sanity.config";

// The standalone Studio, for `npx sanity deploy` (or `sanity build` to host it yourself): the same Studio as the one
// embedded at /studio, on its own domain. Settings are SANITY_STUDIO_* variables, built into the Studio
// (docs/sanity-studio.md). The storefront itself never loads this file.
export default studioConfig(process.env.SANITY_STUDIO_PROJECT_ID ?? "", process.env.SANITY_STUDIO_DATASET || "production", "/");
