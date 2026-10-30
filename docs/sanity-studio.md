# Sanity Studio: embedded or on its own domain

The Studio (pages, blocks, banners, the blog) runs in two ways from the same code ([`src/studio`](../src/studio)):

| | Embedded (default) | Own domain (recommended for production) |
|---|---|---|
| Address | `<shop>/studio` | e.g. `https://forgeline.sanity.studio` or `https://studio.your-shop.com` |
| Setup | Nothing: on when `NEXT_SANITY_PROJECT_ID` is set | `npx sanity deploy` once, plus `STUDIO_URL` in the shop |
| Security | Runs next to your customers' sessions, with `'unsafe-eval'` in its script policy | Separate origin: nothing in the Studio can act on the shop's pages or cookies |

## Why move it

The Studio is a large app with many dependencies, and it needs `'unsafe-eval'`. Embedded, it shares the shop's origin, so a flaw anywhere in it could make requests to the shop as the signed-in customer. On its own domain it can't. Editors notice no difference.

## Moving it

1. **Deploy the Studio** from your machine (signed in to Sanity with `npx sanity login`):

   ```bash
   SANITY_STUDIO_PROJECT_ID=<project id> SANITY_STUDIO_STOREFRONT_URL=https://<your shop> SANITY_STUDIO_HOSTNAME=<name> npx sanity deploy
   ```

   It builds [`sanity.config.ts`](../sanity.config.ts) (the same Studio, at `/`) and publishes it at `https://<name>.sanity.studio`. `SANITY_STUDIO_STOREFRONT_URL` is where the preview pane and the product and category pickers find the shop. To host it yourself instead, `npx sanity build` writes a static site to `dist/`.

2. **Allow the Studio in Sanity:** sanity.io/manage → your project → API → CORS origins → add `https://<name>.sanity.studio` with credentials allowed.

3. **Tell the shop where the Studio is:** set `STUDIO_URL=https://<name>.sanity.studio` in your hosting and redeploy. Then:
   - `/studio` redirects there, and the embedded Studio is no longer served;
   - the shop's pages may be framed by that origin only (the Presentation tool's preview), through `frame-ancestors` in the Content-Security-Policy;
   - `/api/search/suggest` and `/api/catalog/categories` answer that origin's requests (CORS), for the pickers.

4. **Check it:** open a page in the Studio's Presentation tool. The preview should load with draft mode, and clicking a text should select its field. In a product block, the product picker should find SKUs.

## Going back

Remove `STUDIO_URL` and redeploy: `/studio` serves the embedded Studio again.
