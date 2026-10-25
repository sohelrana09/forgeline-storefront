# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A B2B storefront sandbox on **commercetools Composable Commerce**, built with Next.js 15 (App Router) and the commercetools TypeScript SDK. It is a learning project and an agency reference build. The commercetools project key is `ctwara` in the **AWS us-east-2** region. It is loaded with the B2B sample data: 72 industrial products, 6 business units, and 5 stores.

## Commands

```bash
npm run dev          # Next dev server on :3000 (reads .env automatically)
npm run build        # production build (also type-checks)
npm run typecheck    # tsc --noEmit (covers src/ and scripts/)
npm run lint         # eslint (next/core-web-vitals + next/typescript)
npm run ct:hello     # smoke test: credentials, project info, first products/business units
npm run ct:create-bu -- <company-key> <buyer-email>   # create Company BU + Buyer associate
npm run -s ct:query -- <path> [where] [limit]         # read-only GET against the project API (-s for clean JSON to pipe into jq)
npm run ct:contexts  # print business unit → store → channel mapping the storefront uses
npm run ct:seed-buyers  # give every BU buyer the demo password from .env.demo (git-ignored; idempotent)
npm run ct:quote-respond -- <quoteRequestId> [--discount N] [--valid-days N]   # TEST: act as seller, publish a quote
npm run ct:seed-approval-rules [-- --bu <unit> --threshold 10000 --inactive]   # demo approval rule (idempotent)
npm run ct:connect-content-app -- --repo <git ssh url> --tag <tag> --email <you> [--yes]   # deploy the Content app on Connect
npm run ct:media-library [-- --upload <file.jpg>]   # CMS image library on the commercetools CDN (idempotent)
npm run ct:catalog-subscription -- --eventbridge <aws-account-id> [--yes]     # catalog changes → cache refresh (docs/cache-refresh.md)
```

There is no test runner yet. `typecheck` and `lint` are the gates.

After moving or renaming files, restart the dev server with a clean cache (`rm -rf .next`). A stale webpack cache can keep requesting the old path, so client components silently stop hydrating while server-rendered pages and plain forms still look fine.

Scripts in `scripts/` run with `tsx --env-file=.env`. To run a one-off script: `npx tsx --env-file=.env path/to/file.mts`. Use the `.mts` extension if the file uses top-level `await`.

## Project structure (Enterprise Folder Blueprint)

```
src/app/          routing only: route groups (shop), (auth), (checkout), (cached); pages are thin, route-only parts in _components/ (SiteChrome = header + main + footer)
src/features/<x>/ one module per business domain: auth, business-units, catalog, cart, quick-order, checkout, orders, quotes, cms
    components/   the feature's UI (views, forms, cards)
    actions.ts    "use server" entry points ONLY (every export is a public endpoint)
    service.ts    server-side logic and commercetools calls for the feature
    types.ts      the feature's models; utils.ts for pure helpers
src/components/   domain-agnostic UI: ui/ (SubmitButton, Breadcrumbs, Markdown), layouts/ (SiteHeader, SiteFooter)
src/lib/          infrastructure: commercetools/ (clients, customer tokens), utils.ts (formatMoney), rate-limit.ts
```
Features may import another feature's `types`, `utils`, `components` and `service`; never import a feature from `src/lib` or `src/components`. Add `src/store/` (client state) and `src/types/` (app-wide types) only when something needs them.

## Architecture

- **`src/lib/commercetools/client.ts`** is the only place that builds the SDK clients (`apiRoot` admin, `customerApiRoot(token)`); customer password flow and revoke are in `src/lib/commercetools/customer-token.ts`. It exports `apiRoot`, which is already scoped to the project key. It uses the client-credentials flow with the admin API client from `.env`, so it is **server-only**. Import it from Server Components, Route Handlers, Server Actions, or `scripts/`. Never import it from a `"use client"` file.
- **Cached guest pages:** `src/middleware.ts` rewrites guest requests (no `ct_session` cookie, no query parameters) for `/`, `/c/x`, `/p/x`, `/pages/x` to the ISR copies in `src/app/(cached)/g/` (5 minute revalidate, guest context only, every slug listed in `generateStaticParams` because on-demand ISR doesn't work behind the rewrite). Their header cart is the `MiniCartIsland` client island (`/api/cart-summary`). Never read cookies or the session there, and revalidate `"/(shop)"`, not `"/"`, in actions so the guest cache isn't purged. Outside changes refresh it through `POST /api/revalidate` (`ct:content`, the Content app, a catalog Subscription; `docs/cache-refresh.md`).
- **Pages are thin Server Components** (`export const dynamic = "force-dynamic"`): `requireBrowseContext()` (guests allowed) or `requireShopContext()` (signed in), await params, render a feature view. Shareable view state (sort, page, variant) lives in **URL search params**. There is no client-side state library.
- **Pricing uses standalone prices** (`priceMode: Standalone`, no embedded prices). A product's `masterVariant.prices` is always empty. To get a price, query `productProjections()` with price selection (`priceCurrency`, optionally `priceCountry`, `priceChannel` = the store's distribution channel id, and `storeProjection`). Then read `variant.price`, and `variant.price.discounted` if a product discount applies.
- **Product Projection Search is deactivated** in this project (`SearchDeactivated` 400). Use the `productProjections().get()` query endpoint, or enable search in Merchant Center first. The header search (`/search`, autocomplete from `/api/search/suggest`) uses an in-memory index ranked in `features/catalog/search.ts` (names, SKU forms incl. letters-only model codes, categories, attributes, descriptions, typo tolerance); the newer Product Search API answers 404 too.
- **Caching:** rarely-changing data (business units, guest context, category tree, tiles, CMS, search index) goes through `staleWhileRevalidate` in `src/lib/memo.ts`: stale values are served while one background refresh runs. Lists use `ListToolbar`/`listParams` from `src/components/ui/ListToolbar.tsx` for Magento-style paging with `?page`/`?limit` in the URL.
- **Stores have no `countries` set** in the sample data. `STORE_PRICING` in `src/features/business-units/service.ts` maps store key to currency and country (`spain`/`us-*` prices only match with country ES/US).
- **Storefront API client (`CTP_STOREFRONT_CLIENT_*`)** must hold `manage_my_profile`, `manage_my_quote_requests`, `manage_my_quotes`, `create_anonymous_token`, `manage_my_orders` and `manage_my_shopping_lists` **per store** (Merchant Center: "Add scopes for store(s)" for every store the shop sells from). Never reuse the admin client for it.
- **Auth:** `/login` uses the customer password flow (`requestCustomerToken` in `src/lib/commercetools/customer-token.ts`) with the storefront client (`CTP_STOREFRONT_CLIENT_*`). It **always passes an explicit scope list** from `customerScopes()` (`manage_my_profile` + `manage_my_orders:<project>:<store>` per store). Without one, the token inherits every scope of the client, including `manage_project`. Admin endpoints answer 403 for this token. The token lives only in the AES-256-GCM encrypted `ct_session` cookie (`src/features/auth/session.ts`).
- **Guests:** catalog, CMS, quick order and cart are open to guests at `default-store` list prices (`getGuestContext()`, `guest: true`, empty `businessUnitKey`). The first add creates an anonymous token (`manage_my_orders:<project>:default-store` only); token and cart id live in the sealed `ct_guest` cookie. On sign-in, `mergeGuestCart()` re-adds the guest lines to the buyer's cart for their unit (re-priced, unsold SKUs reported) and deletes the guest cart. Checkout, orders and quotes use `requireShopContext()` and send guests to `/login`.
- **Payments:** business buyers order on invoice with a PO (`placeOrderAction`). Consumers and guests pay by card via **commercetools Checkout, Payment Only** (`startCardPayment` opens a session from `src/lib/commercetools/checkout-session.ts`, `CardPayment.tsx` runs the SDK's `paymentFlow`, Checkout creates the order, `finishCardPayment` verifies it). Merchant Center setup: `docs/checkout-setup.md`. Guests check out at `/checkout` (email + address) and see `/order-confirmation/[id]`.
- **Customer kinds:** business buyers (associates of a unit), consumers (signed in, no unit: `context.consumer`, B2C store `default-store`, own addresses via `withMyAddresses()`, orders where `businessUnit is not defined`) and guests (`context.guest`). Quotes and company pages use `requireBusinessContext()`. Sign-up `/register` uses `/me/signup` with a `manage_my_profile` client token; `/forgot-password`, `/reset-password` and `/verify-email` use admin-created customer tokens; emails go through `src/lib/mailer.ts` (dev: printed to the server log; links from `SITE_URL`).
- **Buying context:** `src/features/business-units/service.ts` resolves each business unit to its effective store (Divisions with `storeMode: FromParent` only have `inheritedStores`), the store's distribution channel, and its members (explicit + inherited associates). `currentBuyingContext()` / `requireShopContext()` in `src/features/business-units/context.ts` keep the units the session's `customerId` is a member of and flags `canOrder` (buyer role). The `ct_bu` cookie only picks among them. (`/me/business-units` would need `manage_my_business_units`, which the narrowed token doesn't carry.)
- **Carts** (`src/features/cart/service.ts`): the customer token uses `/in-store/key={store}/me/carts`, both to create with `businessUnit` (commercetools rejects units the customer isn't an associate of) and to read/update. Don't use `/as-associate` with a customer token: it needs project-wide `view_orders`/`manage_orders`, which would expose every customer's carts and orders. Lines are added in one update with a retry on 409. Every export of a `"use server"` file is a public endpoint, so `features/*/actions.ts` only holds entry points; logic lives in `service.ts`.
- **B2B model:** Business Unit (`Company` → `Division` hierarchy) → Associates (customers) with Associate Roles (permission sets such as `CreateMyCarts`, `CreateMyQuoteRequestsFromMyCarts`) → Stores → Distribution Channels → Standalone Prices.

## Routes

Next.js special files: `loading.tsx` skeletons only in account, cart, checkout, quick-order and search (catalog pages have none, so unknown slugs return a real 404 from `generateMetadata`), `(shop)/error.tsx` (retry boundary), `(shop)/not-found.tsx` (shown by `notFound()` inside the shop layout), root `not-found.tsx` (unmatched URLs, real 404), `global-error.tsx`, `robots.ts` (catalog indexable, private pages disallowed) and `sitemap.ts`. SEO: metadata + canonical per page, Product/Breadcrumb JSON-LD (`features/catalog/seo.ts`, guest view only), `next/image` for product images.
Shop pages and the sign-in pages (`(auth)`) share `src/app/_components/SiteChrome.tsx` (header, `<main>`, footer). `/checkout` lives in `src/app/(checkout)/` with a minimal Magento-style header (logo, Secure checkout, Back to cart) and no footer; checkout actions revalidate both `"/(shop)"` and `"/(checkout)"`. The logo is a plain `<a href="/">` (`SiteLogo`) so it always reloads the homepage. All shop pages live in `src/app/(shop)/` and start with `requireBrowseContext()` (catalog, cart, CMS, quick order) or `requireShopContext()` (checkout, orders, quotes); the layout renders `SiteHeader` (category nav, live cart; the layout passes in the BU switcher as `context={<BuyingContextBadge/>}` and `signOutAction={logout}`, so `src/components` never imports a feature) and `SiteFooter` (CMS page links). Auth pages are in `src/app/(auth)/`. The category menu (`components/layouts/CategoryMenu.tsx`) mirrors the Merchant Center tree, Magento style: horizontal bar, vertical dropdowns, level-3 flyouts; `MenuBehavior.tsx` flips a menu leftwards when it would run off the right edge and closes it after a link is clicked (client-side navigation keeps the header mounted).
- Checkout is one page in Magento's order: `CheckoutStep` 1 Shipping address, 2 Shipping methods, 3 Payment method (`PaymentStep`: invoice + PO for business, bank transfer or card for consumers and guests).
- `/` home · `/c/[slug]` category (products are on **leaf** categories only, so query `tree.subtreeIds()`) · `/p/[slug]?sku=` PDP · `/cart` · `/checkout` · `/account` (dashboard), `/account/orders[/id]`, `/account/quotes/...`, `/account/addresses`, `/account/information` (`features/account`; old `/orders/:id` and `/quotes/*` redirect in `next.config.ts`) · `/quick-order` (SKU paste + catalog table) · `/search?q=` · `/login`, `/register`, `/forgot-password`, `/reset-password`, `/verify-email`, `/logout`.
- Catalog reads: `features/catalog/service.ts` (admin client, price-selected), pure helpers in `features/catalog/utils.ts`. Cart: `features/cart`. Checkout and PO: `features/checkout`. Orders: `features/orders`.
- **Company** (`features/company`, `/account/company/*`): profile, users, roles matrix, structure, plus company orders on `/account/orders?scope=company`. What a user sees follows `context.permissions` (from their associate roles in the selected unit); every write and every colleague-data read uses the admin client for the selected unit **only after** a live `hasPermissionNow()` check. The customer token never gets a business-unit scope (the grantable ones are project-wide). `npm run ct:seed-associates` gives admins and approvers the demo password.
- **Approvals** (`features/approvals`, rules in `features/company/approval-rules.ts`): commercetools creates an Approval Flow when an order matches an Active rule of the unit (any order path). Flows and rules exist only under `as-associate/{id}/in-business-unit/key={unit}`: use `asAssociate()` (admin client) with ids from the session only, after a live `hasPermissionNow` (UpdateApprovalFlows / Create- or UpdateApprovalRules). The order stays Open while pending; a rejection cancels it in our code. Routes `/account/approvals[/id]`, `/account/company/approval-rules[/new|/id]`. Demo rule: `npm run ct:seed-approval-rules`.
- **Purchase lists** (`features/purchase-lists`, Magento requisition lists): personal commercetools Shopping Lists through the customer token at `/in-store/key={store}/me/shopping-lists` (`manage_my_shopping_lists:<project>:<store>` per store in `customerScopes()`; project-wide is refused). Stored lines have no SKU or price: expand `lineItems[*].variant` and price with `lookupSkus`; "add to cart" reuses the quick-order path. Re-adding a variant merges quantities. `/me` lists can't carry a business unit, so company-shared lists are deferred. Routes `/account/purchase-lists[/id]`; entry points on the product page, cart and quick order (signed-in only).
- **Quotes** (`features/quotes`): machines (≥ €5,000, `isQuoteOnly`) go into the cart "for quote"; such a cart offers "Request a quote" instead of checkout. Routes `/account/quotes`, `/account/quotes/requests/[id]`, `/account/quotes/[id]`. Quote endpoints exist only as project-wide `/me/quote-requests` and `/me/quotes`, so always check `businessUnit`/`store` after reading. Renegotiation and order-from-quote use the admin client in the quote's store **only after** a customer-token ownership read and a live `hasPermissionNow()` check. Test the seller side with `npm run ct:quote-respond -- <requestId> --discount 10`.
- **Homepage banner and images:** banner blocks (`type: "banner"`, placement `home.hero`, rendered by `HeroBanners`, old hero as fallback); any block can have `startsAt`/`endsAt`. Pictures live on the commercetools CDN as images of the hidden, never-published product `cms-media-library` (`npm run ct:media-library [-- --upload file.jpg]`); content may only use `MEDIA_HOSTS`.
- **CMS** (`features/cms`; model in `types.ts`, reads in `service.ts`): static blocks and pages live in Custom Objects (`cms-block`, `cms-page`). Edit `content/blocks/*.json` / `content/pages/*.json`, then run `npm run ct:content`. Render blocks with `<CmsBlocks placement="…" context={context} categorySlugs={…} />`; new placements go in `PLACEMENTS`. Featured products = a block with `"type": "products"` and `skus`. `/pages/[slug]` renders pages. Merchants edit the same content in Merchant Center through the **Content** custom app in `cms-app/` (its own package; see its CLAUDE.md; production on commercetools Connect via the root `connect.yaml`, see docs/content-app-deployment.md). The JSON files and the app write the same objects, so whichever saved last wins: pick one source of truth per item.

## Environment

`.env` holds `CTP_PROJECT_KEY`, `CTP_CLIENT_ID`, `CTP_CLIENT_SECRET`, `CTP_AUTH_URL`, `CTP_API_URL`, and `CTP_SCOPES`. It is git-ignored and protected by a hook. Claude must not read or edit it. `.env.example` is the committed template. Production builds need `SITE_URL` (the public domain): `next build` fails without it, and canonicals, `robots.txt`, the sitemap and JSON-LD use it.

## Working in this repo

- Path-scoped conventions are in `.claude/rules/`. Subagents are in `.claude/agents/`, skills in `.claude/skills/`, and hooks and permissions in `.claude/settings.json`.
- `docs/claude-code-study-map.md` explains how each of these Claude Code pieces is used here.
- The feature roadmap and task breakdown are in `docs/decomposition.md`. When you implement a feature, pick it from there and update its status.
- Before changing data-dependent code, check real data with `npm run ct:query` or the `ct-data-explorer` agent. The sample data often differs from commercetools docs examples.
