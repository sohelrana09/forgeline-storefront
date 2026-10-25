---
paths:
  - "src/app/**/*.tsx"
  - "src/components/**/*.tsx"
  - "src/features/**/*.tsx"
---

# Next.js frontend conventions

- Default to Server Components that fetch data with `apiRoot`. Add `"use client"` only for interactive islands, and pass them plain serializable props, not SDK objects with methods.
- `searchParams` and `params` are Promises in Next 15. Always `await` them.
- Keep view state that should be shareable or bookmarkable (store, currency, filters, page) in the URL, not in React state.
- Mutations (add to cart, request quote) go in Server Actions (`src/features/<x>/actions.ts`) or Route Handlers, never in client fetches to commercetools.
- Route pages stay thin: access check, params, then render a view from `src/features/<x>/components/`. Put page-sized markup in the feature, not in `src/app/`.
- Styling is Tailwind v4 utility classes only. There is no component library and no CSS modules.
- Product images use `next/image` (`width`/`height` plus `sizes`; `priority` only for the product page's main image). Allowed hosts are in `next.config.ts` `images.remotePatterns`: add a host there before using images from it.
- Two deliberate exceptions use a plain `<img>`: the homepage banner (`HeroBanners`: `getImageProps` + `<picture>` for the phone picture, `fetchPriority="high"` on the first banner because `getImageProps` ignores `priority`) and pictures inside CMS Markdown (unknown size). Content pictures must pass `isMediaUrl` (`src/lib/media.ts`).
