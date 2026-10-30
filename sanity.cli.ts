import { resolve } from "node:path";
import { defineCliConfig } from "sanity/cli";

// Sanity CLI settings for the standalone Studio (sanity.config.ts, docs/sanity-studio.md). The Studio's code imports
// with the app's "@/" alias, so the CLI's build resolves it the same way as Next does. The shop's PostCSS setup
// (Tailwind) is for the storefront only: the Studio brings its own styles.
export default defineCliConfig({
  api: { projectId: process.env.SANITY_STUDIO_PROJECT_ID, dataset: process.env.SANITY_STUDIO_DATASET || "production" },
  ...(process.env.SANITY_STUDIO_HOSTNAME && { studioHost: process.env.SANITY_STUDIO_HOSTNAME }),
  vite: (config) => ({
    ...config,
    resolve: { ...config.resolve, alias: { ...config.resolve?.alias, "@": resolve(process.cwd(), "src") } },
    css: { ...config.css, postcss: { plugins: [] } },
  }),
});
