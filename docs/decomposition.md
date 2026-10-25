# Feature decomposition: B2B storefront

How the work is broken down. **Epics** are user-visible features, and **tasks** are single focused changes, each with its own way to verify it. Tasks within an epic list their dependencies, and the **‖ parallel** markers show which tasks touch separate files, so they could run as separate subagents or sessions.

Status: `[x]` done · `[ ]` todo · `[~]` in progress

> **File paths below are historical.** On 2026-10-24 the code moved to the Enterprise Folder Blueprint (`src/features/<domain>/{components,actions.ts,service.ts,types.ts}`, `src/lib/commercetools/`, `src/components/{ui,layouts}`); see CLAUDE.md "Project structure". For example `src/lib/cart.ts` is now `src/features/cart/service.ts`.

---

## E0 Foundation ✅
- [x] T0.1 Next.js + SDK client (`src/lib/commercetools.ts`). Verify: `ct:hello` connects.
- [x] T0.2 Product grid (`src/app/page.tsx`). Verify: 72 products render.
- [x] T0.3 Store and currency price selection. Verify: the de-fr-uk store shows €35.00 ~~€40.00~~ for Air Filter.
- [x] T0.4 Claude Code setup: CLAUDE.md, rules, agents, skills, hooks.

## E1 Company switcher (B2B context) ✅
**Goal:** a logged-in associate picks a business unit, and the store, catalog and prices follow it.
**Acceptance:** switching LiftTech Ltd → LiftTech SARL changes the price channel without a page error.

| # | Task | After | Files | Verify |
|---|---|---|---|---|
| [x] T1.1 | Map business unit → stores → channel (query helper) | none | `src/lib/b2b.ts` | `npm run ct:contexts` prints all 6 ✓ |
| [x] T1.2 | Persist the selected business unit in a cookie (Server Action) | none | `src/app/actions.ts`, `src/lib/session.ts` | cookie set and read back ✓ |
| [x] T1.3 | Header switcher UI | T1.1, T1.2 | `src/components/BuSwitcher.tsx` | dropdown lists the business units ✓ |
| [x] T1.4 | Grid reads the business unit from the cookie instead of `?store` | T1.1, T1.2 | `src/app/page.tsx` | Eagle → USD list prices; LiftTech ES → EUR with discounts ✓ |

‖ parallel: **T1.1 and T1.2** (separate files, no dependencies).
Notes from the build:
- Confirmed: FR/DE divisions have `storeMode: FromParent` and **no `stores` field**. Read `inheritedStores` (and `inheritedAssociates`).
- `spain` and `us-*` prices are country-restricted (ES/US), so the price query and the cart must send `country`.
- The business unit lives in an httpOnly cookie, not the URL. It's session identity, not shareable view state, and it becomes the logged-in associate's choice in E2.
- React 19 resets a form after its action runs, so the switcher `<select>` needs `key={selected}` or it jumps back to its initial value.

## E2 Customer login (associate) ✅
**Goal:** a buyer signs in and the business units come from their associate assignments.
| # | Task | After | Verify |
|---|---|---|---|
| [x] T2.1 | Demo password for every BU's buyer (`npm run ct:seed-buyers`, password in git-ignored `.env.demo`) | none | 6 set; second run: all "already set" ✓ |
| [x] T2.2 | Password login → customer token → **encrypted** session cookie; `/login`, sign out | T2.1 | wrong password rejected; signed-out `/` redirects to `/login` ✓ |
| [x] T2.3 | Switcher limited to `/me/business-units`; cart create via `/me/carts` + `businessUnit`, read/update via `/as-associate` | T2.2, E1 | own cart created + merged; foreign BU rejected by commercetools ✓ |

Notes from the build:
- **Cart creation:** `POST /as-associate/{id}/in-business-unit/key=…/carts` demands `CreateOthersCarts`, even with the customer's own token. `POST /me/carts` with a `businessUnit` creates the buyer's own cart (needs `CreateMyCarts`); `/as-associate` then reads and updates it with role checks.
- **Token scopes ⚠️:** a password-flow token inherits **all** scopes of the API client that requests it (here `manage_project`). Asking for `manage_my_*` returned "Permissions exceeded" because the admin client doesn't hold them. So the session cookie is AES-256-GCM encrypted (key derived from the client secret) and the browser never sees the token. **Resolved:** a password-flow request may ask for a **subset** of the requesting client's scopes. Login now asks for only `manage_my_profile` + `manage_my_orders:<project>:<store>` per store, so the buyer token gets **403** on admin endpoints however broad the client is. (`view_published_products` can't go on a customer token, and catalog reads stay on the server's admin client.) With that token, carts moved from `/as-associate` (needs project-wide `view_orders`/`manage_orders`) to `/in-store/key={store}/me/carts`. Business-unit membership is computed server-side from the business units' associates. Verified in the browser: sign in as Sofia → quick order 4 lines €2,130 → row Add merges to €2,165.
- Lesson: in Merchant Center, API client scopes can't be edited after creation, and deleting the wrong client breaks the server (`ct:hello` → "invalid client credentials"). Check which client the `.env` values belong to before deleting anything.
- A cart looked up under the wrong business unit returns **400 InvalidOperation**, not 404. `getActiveCart` treats it as "no cart".
- No token refresh yet: the token lasts 48h, then the buyer signs in again.
- Security review fixes: GCM tag and IV lengths are pinned and AAD added; logout revokes the token; a 401 goes to the `/logout` Route Handler (avoids a `/login` ↔ `/` loop); an in-memory login throttle (10 per 15 min per IP and per email) plus a 500 ms failure delay; "wrong password" is distinguished from "auth unavailable"; the seed script refuses projects other than `ctwara`.
- Each sample buyer belongs to exactly one business unit, so the switcher only appears for multi-unit associates (for example the LiftTech admin, who inherits into the divisions).

## E3 Quick order ✅ (without login)
**Goal:** paste `SKU,qty` lines and add them all to the cart in one call.
| # | Task | After | Verify |
|---|---|---|---|
| [x] T3.1 | Parser and validator for the pasted text (pure function), `src/lib/quick-order.ts` | none | bad SKU, bad quantity, duplicates merged ✓ |
| [x] T3.2 | Look up SKUs (one `productProjections` query, `masterVariant(sku in …) or variants(sku in …)`) | none | unknown SKU reported ✓ |
| [x] T3.3 | Cart create (with lines) or ONE update with N `addLineItem` actions; 409 retry once, `src/lib/cart.ts` | T3.1, T3.2 | 4 lines on the Spain channel, €2,165.00 ✓ |
| [x] T3.4 | Quick-order panel + per-row Add, `QuickOrderForm.tsx`, `page.tsx` | T3.3 | 5 lines pasted → 4 added, 1 rejected; row Add merges qty ✓ |

Notes from the build:
- ~~E2 dependency worked around~~: replaced in E2. Carts now belong to the signed-in buyer.
- Products with variants use SKUs like `s567-uv-2015`, not the product key. The lookup matches every variant.
- Items ≥ €/$5,000 show "Request quote" (disabled until E4).
- Each action takes ~4–5s in dev because business units, stores and customers are re-queried every request. Cache `getBuyingContexts` (e.g. `unstable_cache`, 5 min) before going to production.

‖ parallel: **T3.1 and T3.2**.

## E7 Storefront pages (homepage, category, PDP, cart, checkout) ✅
**Goal:** a signed-in buyer browses categories, opens a product, builds a cart and places an order on invoice with a PO number. Prices, shipping and tax follow the selected business unit.

**Acceptance (signed in as Sofia, store `spain`):**
1. `/` shows category tiles, a spare-parts grid (Air Filter €35.00 ~~€40.00~~), recent orders, and a link to `/quick-order`.
2. `/c/excavators` lists 12 products (descendant leaf categories). `/c/amphibious_excavators` lists 3 with a breadcrumb. An unknown slug returns 404.
3. `/p/s567-uv`: the 2015/2019/2023 model links switch SKU and image; spec table; stock from the supply channel; "Request quote" for machines; compatible spare parts with Add.
4. `/cart`: change quantity / remove; BU ship-to; shipping €100 (free above €10k); "incl. 21% VAT".
5. `/checkout`: Standard/Premium (US: Standard only), PO number, Place order → `/orders/{id}` with PO and totals; header cart → 0.
6. Non-buyers see prices but no Add/Checkout. `/quick-order` keeps working (E3 checks).

| # | Task | After | Files |
|---|---|---|---|
| [x] T7.1 | Cache buying contexts (`unstable_cache` 5 min + React `cache`); add BU addresses | none | `b2b.ts`, `session.ts` |
| [x] T7.2 | Catalog lib: category tree by slug, category products (descendant ids), product by slug, products by ids, `isQuoteOnly` | none | `src/lib/catalog.ts` |
| [x] T7.3 | Cart/checkout lib: BU address on cart create, generic update with 409 retry, qty/remove, shipping options, PO (admin, ownership-guarded), place order, my orders | T7.1 | `cart.ts`, `checkout.ts` |
| [x] T7.4 | Shared UI: PriceTag, ProductCard, AddToCartForm, Breadcrumbs | T7.2 | `src/components/*` |
| [x] T7.5 | `(shop)` layout + SiteHeader (switcher, category nav, cart, sign out); move `/` → `/quick-order` | T7.1, T7.2 | `src/app/(shop)/…` |
| [x] T7.6–T7.12 | Quick order on shared components, homepage, category page, PDP, cart page, checkout, order confirmation | T7.3–T7.5 | one route folder each |
| [x] T7.13 | Docs | all | `CLAUDE.md`, this file |

‖ parallel: T7.1 ‖ T7.2 → T7.3 ‖ T7.4 ‖ T7.5 → the route pages (one folder each) → checkout.

Data notes (from the b2b-architect investigation):
- 42 categories (10 roots). Slugs use underscores and differ from keys. Products are assigned only to leaf categories, and `categoriesWithAncestors` is not queryable on projections.
- Product types: heavy-earthmoving (model 2015/2019/2023), heavy-lifting (color lenum), generic-product (12 spare parts). `relatedProducts` points at spare parts.
- **Only the 12 spare parts are under €5,000.** All machines are quote-only (E4).
- Shipping: europe and north-america zones. Standard €/£/$100 (free > 10k); Premium €/£300 (free > 15k, no US rate).
- Tax `standard-tax`: EU included in price (DE 19, ES 21, FR 20, GB 20); US net + state (NY 4%, NC 4.75%). Every BU has 1 address (default shipping and billing).
- **PO number:** neither `MyCartUpdateAction` nor `MyOrderFromCartDraft` can set it. The server sets `Cart.purchaseOrderNumber` with the admin client, only after reading the cart through the customer token (ownership proof). Verified: the order created via `/in-store/key=…/me/orders` copies it from the cart.

Notes from the build (verified in the browser as Sofia unless noted):
- `/` shows 9 machine tiles, 12 spare parts and recent orders (incl. PO). `/c/excavators` → 12, `/c/amphibious_excavators` → 3 with a 3-level breadcrumb, an unknown slug → 404. `/p/s567-uv?sku=s567-uv-2019` switches the model image; machines show "Request quote".
- Cart: qty 12 → 10 and remove both update totals and the header. Checkout: Premium → €1,990.00 incl. VAT €345.38, PO-4711 → order `6ADD3ADB`, header cart → 0.
- **The default shipping method is NOT applied automatically** when a cart gets an address, so new carts are created with the BU address **and** the default method key: ES 5 × Air Filter → €275.00 incl. 21% VAT; Eagle (NY) → $300 net + 4% = $312.00.
- `/me/orders` can't set `orderNumber`, so confirmations show the first 8 characters of the id. Real numbering belongs to the ERP (E6).
- Review fixes: CartSummary shows shipping net for US carts so the rows add up; the delivery choice is validated with `matchingCart` and followed by `recalculate`; checkout and place order re-check the buyer role live (`hasBuyerRoleNow`), not via the 5-minute memo; a failed order re-renders checkout with the current cart version. Still open: `chooseDelivery`/`updateCartLine` failures are only logged (no UI message); two simultaneous first adds can create two carts.
- `unstable_cache` doesn't work in tsx scripts, so BU contexts and the category tree use a 5-minute in-process memo instead.

## E8 Content and merchandising ✅
**Goal:** Magento-style CMS pages and static blocks, featured products on the homepage, related products on the PDP, and a faster homepage.

| # | Task | Files | Verified |
|---|---|---|---|
| [x] T8.1 | Homepage speed: cache category tiles per store (5 min); drop the per-request `/me` check (401s on customer calls → `/logout`); stream CMS blocks with `Suspense` | `catalog.ts`, `session.ts`, `CmsBlocks.tsx` | `/` 1.8–4.1s → first byte ~0.45s, full ~0.8s; other pages ~0.65s → ~0.4s |
| [x] T8.2 | CMS layer on Custom Objects (`cms-block`, `cms-page`), 60s cache, swappable backend | `src/lib/cms.ts` | |
| [x] T8.3 | Content as JSON files + idempotent sync `npm run ct:content` (`--prune` deletes removed files) | `content/`, `scripts/sync-content.ts` | second run: all `=` |
| [x] T8.4 | `<CmsBlocks placement>` (Markdown or products) on home, PLP, PDP, cart; `/pages/[slug]` + footer | `CmsBlocks.tsx`, `Markdown.tsx`, `(shop)/pages/[slug]` | correct blocks per page, store and category; unknown page → 404 |
| [x] T8.5 | Featured products = CMS "products" block (`home-featured.json`, list of SKUs) | content | 4 products on `/` |
| [x] T8.6 | PDP related products: "Compatible spare parts" (`relatedProducts` attribute) + "More in {category}" (same leaf category) | `p/[slug]/page.tsx` | s567-uv shows both |

Notes:
- **commercetools has no CMS.** Its own option is commercetools Frontend/Studio. Most projects add a headless CMS (Contentful, Storyblok, Contentstack…). Custom Objects work, but Merchant Center has no editor for them, so content is edited as JSON in git and synced. For business-user editing, swap `src/lib/cms.ts` for a headless CMS client; nothing else changes.
- Placements: `home.top`, `home.featured`, `plp.top`, `pdp.below-add-to-cart`, `pdp.bottom`, `cart.sidebar`. Targeting: `stores` (store keys), `categories` (slugs; matches the category or any ancestor).
- Markdown is rendered with react-markdown: raw HTML in content is never rendered.
- Review fixes: a failing or malformed "products" block renders nothing instead of breaking the page; content links allow only "/path", https: and mailto:; a revoked token on cart create or checkout now goes to `/logout` (the catch blocks re-throw Next redirects); `--prune` is a dry run unless `--yes` is added, refuses to run with no content files, pages through more than 500 objects and retries deletes on 409; the sync validates `active`, SKUs, stores, categories and CTA links.

## E9 Merchant Center content editor + enterprise structure
**Goal:** merchants edit CMS blocks and pages inside Merchant Center; the codebase follows the Enterprise Folder Blueprint.

| # | Task | Status |
|---|---|---|
| [x] T9.1 | Restructure into `src/app` (routing only: `(shop)`, `(auth)`), `src/features/<domain>`, `src/components/{ui,layouts}`, `src/lib/commercetools` | typecheck, lint, all routes, Add to cart verified |
| [x] T9.2 | Scaffold Custom Application `cms-app` (`create-mc-app`, starter-typescript, `aws-us`, `ctwara`) | dev server runs on :3001 |
| [x] T9.3 | Content › Blocks / Pages: list, create, edit (versioned), delete with confirmation, Manage permission, validation mirrored from the sync script | typecheck + lint clean |
| [x] T9.4 | Try it signed in to Merchant Center (dev); edit a block and see it on the storefront within 60s | edited `cart-invoice-note` in Chrome → saved as v2 → shown in the cart sidebar ~6s later → reverted (v3), sync reports it identical to the JSON file |
| [~] T9.5 | Production: Connect-ready (`connect.yaml`, app moved to `cms-app/`, config from env, production build tested), registered in Merchant Center (Draft, ID `cmvns244e000201xf0kp953tg`), deploy script `ct:connect-content-app`. Waiting on: GitHub repository + tag, then publish/deploy, URL, Ready, install (docs/content-app-deployment.md) | registration done; deployment pending the push |

Notes:
- OAuth scopes are `view_key_value_documents` / `manage_key_value_documents` (Custom Objects), nothing else.
- The template's `react-use` typings don't match React 19, so the app's tsconfig sets `skipLibCheck`.
- The template's `.gitignore` deliberately keeps its `.env` (non-secret dev flags) in git.

## E4 Quotes ✅
Cart → `QuoteRequest` → seller creates a `StagedQuote` (Merchant Center, or `npm run ct:quote-respond` for tests) → `Quote` → buyer declines, asks for changes, or accepts and places the order.

| # | Task | Verified |
|---|---|---|
| [x] T4.1 | Buyer token gets `manage_my_quote_requests` + `manage_my_quotes` (project-wide; "my" = own records). A 403 `insufficient_scope` signs the stale session out | old session → `/login`; new sign-in works |
| [x] T4.2 | `hasPermissionNow(bu, customer, permission)`: live associate-role check for admin-client calls made for the buyer | used by renegotiate and the order fallback |
| [x] T4.3 | Machines: "Add for quote" (same cart). Cart with machines shows "Request a quote" instead of Checkout; other carts can request one optionally | S567 → cart → request |
| [x] T4.4 | `ct:quote-respond -- <requestId> [--discount N] [--valid-days N] [--comment]`, sandbox-only, idempotent | 4 quotes created; rerun says "already has quote" |
| [x] T4.5–T4.9 | `features/quotes` (service, actions, views); `/quotes`, `/quotes/requests/[id]`, `/quotes/[id]`; cancel, decline, renegotiate, accept + order with PO; order page links to its quote | browser: request FB569D05 → quote 2697107C (5% off, €7,320) → order 35C71C2B with PO-Q-UI |
| [x] T4.10 | Docs | this section, CLAUDE.md |

Notes from the build:
- **No in-store "me" endpoints for quotes.** Use `/me/quote-requests` and `/me/quotes`, then check `businessUnit`/`store` in code. A request inherits the store from its cart.
- **The source cart stays Active** after a request, so the action drops the `ct_cart_<bu>` cookie (otherwise the same cart could be submitted twice).
- **Accept + order is one call** (`quoteStateToAccepted: true`): ordering requires the quote to still be Pending.
- **`/me/orders/quotes` returns 403** for the narrowed token (needs project-wide `manage_my_orders`; ours is per store), so ordering falls back to the admin client in the quote's store after: customer-token ownership read, Pending + not expired + version check, and a live `CreateMyOrdersFromMyQuotes` check. Same pattern for renegotiation (no `/me` action exists) with `RenegotiateMyQuotes`.
- PO numbers can only be set on the order after it exists (admin call). If that write fails, the buyer still lands on the order (with a note) instead of an error, since the order already exists; a 409 is retried once.
- Review fixes: the order always uses the guarded admin path (no `/me` attempt, so no unrelated 403 can trigger it); admin-backed actions require the quote's store to equal the selected store; `cancelRequest` checks the buyer role; `ct:quote-respond` resumes a half-done run from its existing staged quote.
- Test data left in the sandbox: several Submitted/Declined/renegotiated quotes and two orders from quotes (PO-Q-1, PO-Q-UI) on Sofia's Spain unit, plus 4 source carts.

## E10 Guest cart + merge on sign-in ✅
Guests browse at list prices and fill a cart (parts and machines "for quote"); signing in moves the lines into the buyer's cart for their unit, Magento style. Checkout, quotes and orders stay sign-in only.

| # | Task | Verified |
|---|---|---|
| [x] T10.1 | Anonymous token (storefront client, `manage_my_orders:<p>:default-store` only), created on the first add, refreshed on expiry; sealed `ct_guest` cookie holds token + cart id | probe: guest cart 201 in default-store, 403 in other stores and on admin endpoints |
| [x] T10.2 | Guest context: `default-store` list prices; `requireBrowseContext()` for catalog, cart, CMS, quick order; `requireShopContext()` keeps checkout, orders, quotes signed-in only | guest home, PDP, quick order, cart; `/checkout` → `/login` |
| [x] T10.3 | Guest header and cart: "Sign in" link, no unit switcher or quotes; "Sign in to check out / request a quote" | browser |
| [x] T10.4 | Merge on sign-in: re-add the guest lines to the unit's cart (re-priced), report SKUs the unit's store doesn't sell, delete the guest cart; `/cart?merged=N&skipped=…` banner | script: 2 lines merged into LiftTech cart, machine €10,450 → €8,550; guest cart gone; second merge no-op |
| [x] T10.5 | Browser sign-in with a guest cart | Sofia: 5 guest lines (€14,450 list) → LiftTech Soluciones (Spain) cart €12,075 incl. 21% VAT, excavator €12,375 → €10,000, "Request a quote" shown; `/cart?merged=5` banner |

Notes from the build:
- **Not commercetools' own anonymous-cart merge.** Signing in with `anonymous_id` merges carts, but it knows nothing about business units or stores (the guest cart is in `default-store`, the buyer's in their unit's store), so the lines are re-added instead.
- A guest token's scope response carries `anonymous_id:<id>`; the token lasts 3h, the refresh token keeps the same guest. Server Components can't write cookies, so a refreshed token is only stored by the next Server Action.
- Review fixes: new guest carts are throttled per IP (30 per 15 min); an auth-server outage or a revoked guest token means "no guest cart", never an error page or a redirect; an expired buyer session goes to `/logout` instead of silently becoming a guest; the guest cookie is deleted right after a merge; sign-out clears it too.
- Known gap: a double-submitted sign-in could merge the same guest cart twice (both read it before either deletes it).
- The guest context uses the empty business unit key: guest carts have no `businessUnit`, so `getActiveCart`'s unit check compares against `""`.

## E11 Customer account (Magento "My Account") ✅
`/account` with a sidebar: My account (dashboard), My orders, My quotes, Address book, Account information. Orders and quotes moved under it (`/account/orders/[id]`, `/account/quotes/...`); `next.config.ts` redirects the old `/orders/:id` and `/quotes/*` links.

| # | Task | Verified |
|---|---|---|
| [x] T11.1 | Account layout + `AccountNav` (active section also on detail pages); header link "My account" | browser, desktop and narrow (nav becomes a tab row) |
| [x] T11.2 | Dashboard: contact info, company, default billing/shipping, last 5 orders, "N quotes waiting" | Sofia: 1 quote waiting, 5 recent orders |
| [x] T11.3 | Account information: edit first/last name via `/me` (`manage_my_profile`), 409 retry; email read-only | save shows "You saved the account information." |
| [x] T11.4 | Address book: company default billing/shipping and other unit addresses (read-only), personal `/me` addresses | Sofia: Madrid unit address + her Barcelona address |
| [x] T11.5 | My orders: paged grid (10 per page) with Magento labels (Open → Pending, Confirmed → Processing), View order, Reorder | 8 LiftTech Spain orders |
| [x] T11.6 | Order view: status badge, items ordered, totals, order information (shipping/billing address, shipping method, payment = invoice + PO), quote link, Reorder | order 35C71C2B; Reorder of 39B807F4 added 3 lines (+€400) |
| [x] T11.7 | My quotes: existing quote views under `/account/quotes` with account breadcrumbs | `/quotes` redirects |

Notes from the build:
- Buyers can't edit company addresses here: that needs `manage_my_business_units` on the token (and the associate's `UpdateBusinessUnitDetails` permission). Follow-up for company admins.
- Password change is not built yet (`/me/password` needs the current password; it would also change the shared demo password).
- `StateBadge` moved to `src/components/ui` (orders and quotes both use it).
- Review fixes: `?page=` is clamped to whole numbers 1 to 1000 (offsets past 10,000 are a 400); Reorder that can add nothing returns to the order with a notice; profile edits are rate-limited (20 per 15 min) and need at least one letter; a 401 on the profile 409 retry signs out; `getMyOrder` uses the shared `UUID` check.
- Blueprint fix: `SiteHeader` no longer imports features. The shop layout passes the buying-context area (`features/business-units/components/BuyingContextBadge`) as the `context` slot and `logout` as `signOutAction`.

## E12 Magento header, list toolbars, faster account ✅
| # | Task | Verified |
|---|---|---|
| [x] T12.1 | Header like Magento: top bar (buying for / switcher · welcome, Quick order, My account, Sign out or Sign in), main row (logo · search · mini-cart with item count and total), category nav | browser |
| [x] T12.2 | Header search: `/search?q=` over an in-memory index of names, SKUs and slugs (Product Search API answers 404: not activated) | "filter" → 3; "e" → 62 over 7 pages |
| [x] T12.3 | `ListToolbar` (Magento "Items x to y of z total", pager, "Show 10/20/50 per page"; params clamped) on My orders, My quotes (two grids: `?page/limit`, `?rpage/rlimit`) and search | orders 8 of 8; quotes 7 and 9; search page 2 and limit 50 |
| [x] T12.4 | Speed: `staleWhileRevalidate` cache (`src/lib/memo.ts`) for business units, guest context, category tree, tiles, CMS, search index: no request waits for a reload; account `loading.tsx` so the sidebar answers clicks at once; quotes counted and paged in the query instead of loading 50 | account pages ~0.5 s warm (were 0.5 to 2 s); dev first-compile still ~5 s per route |

Notes from the build:
- The pager seemed "missing" because a list that fits one page hides it; the toolbar now always shows the count and page size, like Magento.
- The greeting uses the first name stored in the session at sign-in (and re-saved when the buyer edits their name), so no `/me` call per page. Sessions from before this change show the email until the next sign-in.
- To replace the stand-in search, activate Product Search in Merchant Center and switch `searchProducts` to `POST /products/search`.
- Review fixes: pages are clamped to offsets commercetools accepts (≤ 10,000), so `?page=300&limit=50` shows "past the end" instead of an error; a failed cache refresh retries after 30 s instead of on every request; the search index is per store and skips unpriced products, so totals match the cards; `where` values go through `str()` in `src/lib/predicate.ts`; a membership change can take ~5 minutes to show outside the live-checked order paths (documented at the memo).

## E13 Company area by role (Magento B2B "Company") ✅
Under My account: Company profile, Company users, Roles and permissions, Company structure, and Company orders for users who may see others' orders. What a user sees and may do follows their associate roles in the selected unit.

| # | Task | Verified |
|---|---|---|
| [x] T13.1 | Per-unit permissions in the buying context (`permissions`, from the associate roles), used to show or hide company features | Oliver: UpdateAssociates + ViewOthersOrders in the company and (inherited) all 3 divisions; Sofia: 16 buyer permissions |
| [x] T13.2 | Company profile (all associates); edit name + contact email with `UpdateBusinessUnitDetails` | browser (buyer: read-only, "Your roles: Buyer") |
| [x] T13.3 | Company users: explicit + inherited associates with roles; with `UpdateAssociates`: add an existing customer by email, change roles, remove (explicit only, never yourself) | script: buyer refused; admin add/duplicate/unknown email/roles/empty roles/self-edit/remove; browser: buyer read-only |
| [x] T13.4 | Roles and permissions matrix (read-only: associate roles are project-wide) | browser, "(you)" marks own permissions |
| [x] T13.5 | Company structure tree (company and divisions), switch to units you belong to | browser |
| [x] T13.6 | Company orders (`ViewOthersOrders`): My orders can switch to all of the unit's orders; colleagues' orders open read-only | script: admin sees 8 ES orders, buyer refused |
| [x] T13.7 | Demo passwords for admins and approvers too (`npm run ct:seed-associates`) | 9 accounts set, 6 buyers already set |

- Review fixes: each write attempt (and each 409 retry, up to 3) reads the unit and roles once and decides on that data: the actor's permission, roles they may grant (no role with more than their own rights; own-purchasing "My…" permissions excepted, since the admin role has none), and at least one user manager must remain. Reads check membership live; colleagues' emails only for user managers; the structure shows only your units and their parents; a revoked "company orders" permission falls back to your own orders.
- Browser check as admin Oliver: users page offers add/roles/remove for others and nothing on his own row; unknown email refused; William Buyer → Approver + Buyer → Buyer (live data confirmed back to the original); profile edit form; full structure with switch buttons; Spain company orders 8 rows with "Placed by Sofía López" (names from the company user list, since orders placed with a customer token carry no email); a colleague's order opens without Reorder.
- Not built: inviting people who have no customer account (needs account creation + email), editing company addresses, adding divisions (`AddChildUnits`), approval rules (E5).
- The storefront API client may grant `manage_business_units` (project-wide). The app never requests it; consider removing it from the client in Merchant Center.

Design: no business-unit scope on the customer token. The storefront client could grant `manage_business_units`, but that is project-wide (every company). Company reads and writes use the admin client after a live `hasPermissionNow()` check in the selected unit, like quote renegotiation.

## E14 B2C customers: consumer accounts, sign-up, password reset ✅
Customers without a company shop as consumers: the default store's EUR list prices (VAT included), their own cart, address book and orders. Business-only areas (quotes, company) send them back to their account.

| # | Task | Verified |
|---|---|---|
| [x] T14.1 | Consumer context (`consumer: true`, empty unit key, B2C store) instead of `/no-access`; `requireBusinessContext()` for quotes and company; customer tokens always get `manage_my_orders` for the B2C store | browser: header "Personal account", no quotes/company in the sidebar, `/account/quotes` → `/account` |
| [x] T14.2 | Sign-up `/register` via `/me/signup` with a client token limited to `manage_my_profile`; signs in and merges the guest cart (machines skipped for consumers) | guest air filter + excavator → sign-up → "1 line added", excavator reported |
| [x] T14.3 | Email verification (`/verify-email` route) and password reset (`/forgot-password`, `/reset-password`), 30 min tokens, same answer for unknown emails; dev mailer prints emails to the server log; links built from `SITE_URL` | verify → notice, reuse → "expired"; reset for unknown email sends nothing; reset → new password → sign in |
| [x] T14.4 | Consumer address book: add, edit, delete, default shipping/billing via `/me`; countries = the "europe" shipping zone (DE, ES, FR, GB) | Berlin address saved as default |
| [x] T14.5 | Consumer checkout: own addresses, no PO, bank-transfer note until card payments (gap 2); orders without a business unit | order CFCD8769: €35 + €100 shipping, 19% DE VAT included, €135 |

Notes from the build:
- The storefront API client can also be given `manage_customers` (every customer). The app only ever requests `manage_my_profile` for sign-up; remove the wider scopes from the client in Merchant Center.
- Sign-up says when an email already has an account (usual shop behaviour), rate-limited to 5 per IP per 15 minutes; forgot-password never reveals it.
- No real email delivery yet: set a provider in `src/lib/mailer.ts` and `SITE_URL` before production.
- Review fixes:
  - Before someone is treated as a consumer, a live check (cached 60 s) asks commercetools whether they belong to any unit; an associate whose unit can't be shopped goes to `/no-access` instead of silently getting consumer prices. Business units are loaded page by page.
  - Consumers must confirm their email before placing an order (checkout shows a notice and a "send a new link" button).
  - The verification link opens a page with a confirm button (email scanners that open links no longer use up the token).
  - Reset requests use their own throttle (3 per email, so they can't lock anyone out of sign-in) and run after the response (no timing difference between known and unknown emails).
  - Rate limits read the client IP from `x-real-ip` or the last `x-forwarded-for` hop and prune old entries.
  - `/reset-password` and `/verify-email` send `Referrer-Policy: no-referrer` and `Cache-Control: no-store`.
- Open: commercetools doesn't end existing sessions when a password is reset (tokens last up to 48 h); the rate limiter is per process and needs a trusted proxy plus Redis before production.
- Test consumer: `DEMO_CONSUMER_EMAIL` / `DEMO_CONSUMER_PASSWORD` in `.env.demo`.
- Next: card payments and guest checkout (gap 2).

## E15 Card payments (commercetools Checkout) and guest checkout (parked)
Consumers and guests pay by card through commercetools Checkout in **Payment Only** mode: our checkout collects address and delivery, and Checkout shows the payment methods, takes the payment through a Connector and creates the Order. Business buyers keep invoice + PO. Setup steps: `docs/checkout-setup.md`.

| # | Task | Verified |
|---|---|---|
| [x] T15.1 | Checkout Session client (`src/lib/commercetools/checkout-session.ts`): admin-client token narrowed to `manage_sessions` + `manage_orders` for the B2C store; region from `CTP_API_URL`; app key `CTP_CHECKOUT_APPLICATION_KEY` | Sessions API answers 201 for `ctwara` |
| [x] T15.2 | `startCardPayment` / `finishCardPayment`: own cart, reviewed version, delivery + email set, no machines, verified email (consumers); the order must come from the caller's cart before the cart is cleared | session created for Clara and for a guest |
| [x] T15.3 | `CardPayment` (client): SDK `paymentFlow` inline (`data-ctc`), success → order page, failure → retry, setup errors → friendly message | without an Application: `init_error` + CORS, shown as "Card payment is unavailable" |
| [x] T15.4 | Guest checkout: "Check out as guest" in the cart; email, address (shared `AddressFields` / `parseAddress`), delivery method on the guest cart; `/order-confirmation/[id]` read with the guest token | guest Madrid address → ES 21% VAT, €135 |
| [ ] T15.5 | Setup: Checkout on, sample payment Connector, Payment Only Application `ironline-payment`, card integration active | 25 Oct: connector redeployed as `dd7ad399` with its own client `sample-payment-connector` (7 scopes); integration "Card (sample connector)" (`ironline-card-v2`) created in Merchant Center on it, connector status Available, old `ironline-card` (dead deployment) deactivated. Checkout accepts the session and cart (country ES now set) and lists the connector, but `payment-config` still returns no methods and never calls the processor (processor logs: only Merchant Center's own status/components calls, all 200). Session scope widening made no difference. Open with commercetools support |
| [ ] T15.6 | Real test payment (sample connector test cards) for a consumer and a guest | |

Note (25 Oct): the storefront API client in `.env` was recreated with project-wide `manage_my_profile`, `manage_my_orders`, `manage_my_quote_requests`, `manage_my_quotes`, `create_anonymous_token` plus **per-store** `manage_my_orders` for all five stores (the app requests store-scoped order scopes; a project-only `manage_my_orders` can't grant them, so sign-ins fail with `invalid_scope`). Both sign-ins verified, admin endpoints 403. The store section also carries extra store-level `manage_*`/`view_*` scopes the app never requests; trim them on the next rotation.

**Parked (25 Oct):** the card code is complete and stays as is, but Checkout returns no payment methods for `ironline-payment` (see T15.5). To resume: get the cause from support, set `B2C_CARD_PAYMENTS=true`, then run T15.6 with test card 4111 1111 1111 1111.

| # | Task | Verified |
|---|---|---|
| [x] T15.7 | B2C fallback: with `B2C_CARD_PAYMENTS` unset/false, consumers and guests place the order directly (`placeBankTransferOrderAction`, same readiness checks as card: own cart, reviewed version, delivery, email, no machines, confirmed email for consumers) and pay by bank transfer | guest order 922D5121 (Madrid, €135) → `/order-confirmation`, cart cleared |
| [x] T15.8 | Consumer bank-transfer order | Clara: guest line merged on sign-in, checkout DE (19% VAT, €135) → order DEE47A0E, "Bank transfer", cart cleared. Business sign-in (Sofia) works again; her token is refused on admin endpoints (403) |

Notes from the build:
- Review fixes:
  - After payment the order total is compared with the reviewed total. The cart stays open while the payment form shows, so another tab could change it; a different total shows a notice on the order page.
  - If the success callback is lost (closed tab), `/checkout` finds the order its cart became and opens it.
  - "Paid by card" shows only when a payment is attached.
  - Per-IP limits on starting payments and saving guest details.
  - One B2C store constant (`src/lib/commercetools/stores.ts`).
- To confirm on the first real payment: the session token has `manage_sessions` plus `manage_orders` for the B2C store only. The docs tie only `manage_sessions` to session creation, and Checkout creates the order with its own permissions. If the first payment fails with 403, widen to project-wide `manage_orders`.
- Open:
  - Each "Pay by card" click opens a new session (reuse per cart version later).
  - Guest emails aren't verified (receipts can go to a mistyped address).
  - Checkout's order-created events (a Subscription) should become the source of truth when order emails arrive (gap 4).
  - The Checkout SDK logs an "Uncaught (in promise)" of its own when it can't initialise.

## E16 Indexable public catalog (SEO) ✅
The catalog (home, categories, products, content pages) is indexable at guest list prices; personal and transactional pages stay out.

| # | Task | Verified |
|---|---|---|
| [x] T16.1 | `robots.ts`: allow the catalog, disallow account, cart, checkout, order confirmation, quick order, search, sign-in and password pages; sitemap link | curl `/robots.txt` |
| [x] T16.2 | `sitemap.ts` (hourly): home, all categories, all products (paged, lastModified), active CMS pages; URLs from `SITE_URL` (`src/lib/site-url.ts`) | 118 URLs |
| [x] T16.3 | Metadata: title template + `metadataBase`; product, category and CMS pages get title, description, canonical (product without `?sku=`, category with `?page=` from page 2), Open Graph | PDP: "Air Filter \| Ironline Supply", canonical, og:image |
| [x] T16.4 | JSON-LD: Product (name, SKU, images, offer price + availability; no offer for quote-only machines) and BreadcrumbList on product pages (guest view only, so contract prices never reach markup); BreadcrumbList on category pages; `<` escaped | price 35.00 EUR, InStock |
| [x] T16.5 | Real 404s: unknown product, category and CMS slugs call `notFound()` in `generateMetadata`; the shop-wide `loading.tsx` moved to cart, checkout, quick order and search (a streamed skeleton forces status 200) | `/p/does-not-exist` 404 for Googlebot and browsers |
| [x] T16.6 | `next/image` for product images (remotePatterns: the sample-data bucket only); product page image is `priority` | air filter 11.6 KB instead of 76.8 KB |

Notes:
- Trade-off: catalog pages show no skeleton while loading (needed for real 404s). Client navigation waits ~0.5 s for the page instead.
- Caching rendered guest pages followed in E17.
- Set `SITE_URL` to the public domain in production: canonicals, sitemap and JSON-LD URLs use it.
- Review fixes:
  - The sitemap lists only products in the guest store's assortment (same projection as the product page).
  - Image optimizer allows only the sample-data bucket (no `*.commercetools.com` wildcard: add the exact CDN host when Merchant Center uploads are used).
  - `metaDescription` strips markdown without eating hyphens and brackets.
  - `noindex` on account, cart, checkout, order confirmation, quick order, search (noindex, follow) and all sign-in/password pages.
  - Order confirmation got its skeleton back; the shop 404 page has guest-neutral wording.
  - No empty `image` in JSON-LD; category pages past the last page answer 404.

## E17 Cached guest pages ✅
Guests (no `ct_session` cookie) get the home, category, product and content pages from the Next.js page cache (regenerated at most every 5 minutes); signed-in visitors and URLs with query parameters still render per request.

| # | Task | Verified |
|---|---|---|
| [x] T17.1 | Header cart as a client island: `GET /api/cart-summary` (`private, no-store`), `MiniCartIsland` loads it on mount, on focus and on the `cart:changed` event that `AddToCartForm` fires; `SiteHeader` takes a `cartSlot` | guest add to cart: header 0 → 1 item, €35.00 |
| [x] T17.2 | Cached copies under `src/app/(cached)/g/` (`revalidate = 300`, `dynamic = "error"`, guest context only); `HomeView` moved into `features/catalog` so both routes share it | build lists `/g/...` as ISR, 5m |
| [x] T17.3 | `src/middleware.ts`: guest GET/HEAD without query parameters on `/`, `/c/x`, `/p/x`, `/pages/x` is rewritten to `/g/...`; direct `/g/...` URLs redirect (308) to the public path | `x-nextjs-cache: HIT`, ~8 ms instead of ~600 ms |
| [x] T17.4 | Server actions revalidate `"/(shop)"` instead of `"/"`, so a cart change doesn't purge the shared guest cache | 14 calls in 7 files |

Notes:
- Next 15.5 matches on-demand ISR against the URL before the middleware rewrite (`/c/x`, not `/g/c/x`), so an empty `generateStaticParams` never caches anything. The cached routes list every category, product (guest assortment) and active content page at build time. A slug added after the build still works, but renders per request until the next build.
- The build now needs commercetools access (it prerenders about 120 pages).
- Content and price changes reach guests within 5 minutes; there is no on-demand purge from `ct:content` or the Merchant Center app.
- Review fixes: campaign parameters (`utm_*`, `gclid`, `fbclid`, `msclkid`) still get the cached page; the mini cart reloads on tab focus at most every 30 s; the cached layout has `dynamic = "error"` too, so a cookie read in the header or footer fails the build.
- Behind a CDN, the page must not be shared between guests and signed-in visitors on the same URL: the CDN has to bypass its cache when the `ct_session` cookie is present (Vercel runs middleware before its cache, so it already does). A `Vary: Cookie` set in middleware doesn't help: Next replaces it.
- Add to cart posts to the public URL, which isn't rewritten, so the action response re-renders the per-visitor page and the header switches to the server-rendered cart. Harmless; the next navigation is cached again.

| # | Task | Verified |
|---|---|---|
| [x] T17.5 | `POST /api/revalidate` (`src/lib/revalidate-auth.ts`): Bearer `REVALIDATE_SECRET`, or a Merchant Center forward-to token (RS256 against the MC API's keys; issuer, audience, expiry, type, project). Purges `revalidatePath("/(cached)/g", "layout")` and clears the catalog/content memos | prod build: HIT → POST → MISS → HIT; 401 for no, wrong and forged auth; local-key test of 7 token cases |
| [x] T17.6 | `ct:content` calls it after writing or deleting | no-change run makes no call |
| [x] T17.7 | Content app calls it through `/proxy/forward-to` after save and delete (`use-storefront-refresh`, `additionalEnv.storefrontUrl`) | typecheck + lint; not run end to end (needs a public storefront URL) |
| [x] T17.8 | `ct:catalog-subscription`: Subscription `storefront-cache-refresh` (changes to standalone prices, products, discounts, categories, Custom Objects) to EventBridge or Pub/Sub; AWS steps in `docs/cache-refresh.md` | dry run; not created (no queue yet) |

- Review fixes: unknown key ids reload the MC key set at most once a minute (one shared, time-limited load; stale keys kept on failure; 107 test tokens caused 1 fetch); 10 s clock skew and `nbf`; calls within 10 s of a purge are coalesced; the Content app sends the content type to the storefront (not the MC API), warns on any HTTP error, and refuses a production build without `STOREFRONT_URL`.
- `revalidatePath("/g", "layout")` purges nothing: the cache tags use the route-group path, so it has to be `"/(cached)/g"`.

## E18 Product image gallery ✅
Magento-style gallery on the product page. 59 of 72 products have 3 pictures (one per model year or color), 12 have one.

| # | Task | Verified |
|---|---|---|
| [x] T18.1 | `galleryImages()` (`features/catalog/utils.ts`): distinct images across variants, each with the SKUs that use it and its model year or color | S567 UV: 2015, 2019, 2023 |
| [x] T18.2 | `ProductGallery` (client): starts on the selected variant's picture; arrows, arrow keys, swipe, thumbnails; "Choose this model/color" for another variant's picture; full-screen native modal dialog | browser: `?sku=…-2019` opens on image 2 of 3; Escape and Close; 375 px without sideways scroll |

Notes:
- The browser pane never fired the dialog's `close` event, so the page scroll lock is CSS only: `html:has(dialog:modal) { overflow: hidden }` plus `scrollbar-gutter: stable`, no JavaScript to undo.
- Review fixes: a swipe no longer also opens full screen; images shared by variants keep every SKU; a new picture replaces the old one at once (keyed `Image`) instead of lingering under the new caption; screen readers hear "Image 2 of 3: Model year 2019" and the zoom button names the picture.
- The stage is 4:3 because the sample photos are 1792 × 1024; single-image products show no arrows or thumbnails.

## E19 One-step checkout and search autocomplete ✅
Magento's one-page checkout layout, and a search that understands model codes, typos and suggests as you type.

| # | Task | Verified |
|---|---|---|
| [x] T19.1 | Checkout as numbered steps: 1 Shipping address (saved address cards, "+ New address" for consumers; email + address form for guests), 2 Shipping methods (price · method table, "Free" above the threshold), 3 Payment method (the customer kind's method shown selected, billing address, PO number for business, Place order); order summary with the items beside it, sticky on desktop | guest: save → step 3 opens, €135.00 incl. 19% DE VAT; consumer Clara: choose Standard → total €500.00 |
| [x] T19.2 | Steps wait for each other ("Choose a shipping method first."); a "Saving…" note while an address or method is saved | browser |
| [x] T19.3 | Search index (`features/catalog/search.ts`): names, SKUs in every typed form (`s567-uv`, `s567uv`, letters-only `suv`), categories with their parents, attributes, descriptions. Ranking: whole word, start of word, inside a word, then typos (1 edit, 2 for words of 8+ letters) only for words that match nothing as typed; the page says "Showing results for" | "suv" → S567 UV; "excavatr" → 13 excavators; "hydralic hose" → Hydraulic Hose |
| [x] T19.4 | Autocomplete: `GET /api/search/suggest` (from the index, per visitor, rate limited) and `SearchBox` (ARIA combobox, 150 ms debounce, arrows/Enter/Escape, up to 3 categories + 6 products with picture, SKU and price, "View all N results") | "suv" + ArrowDown + Enter opens `/p/s567-uv` |

Notes:
- "suv" found nothing before because no product, category or description contains it: it is the letters of the model code S567 UV. Model codes are now also indexed by their letters.
- Suggestions show the index's price (the master variant's, or "From" the lowest when variants differ; refreshed every 5 minutes); the product page shows the live price of the selected variant.
- Review fixes:
  - Choosing another address now always saves it; a method that doesn't ship there is dropped instead of the whole change failing silently. Save errors show next to the steps.
  - Place order / Pay by card wait while steps 1-2 are saving or a guest has unsaved edits (`CheckoutStatus`); a guest sees "Save your changes before placing the order."
  - Forms keep what was typed when the server answers with an error (`keepFields`: React resets a form after its action).
  - A business buyer whose unit has no address is told to ask the company admin, not sent to the consumer address book.
  - Search: Enter opens a highlighted row only if it belongs to the current text; failed or refused requests clear the list; "View all results" is the last option; a hidden status line announces the count; rate limit raised for normal typing.
- `useFormStatus` never reported the auto-submitted delivery form as pending in this setup; the pending flag from `useActionState` does.

## E20 Homepage banner, image uploads, content editor ✅
Merchants manage the homepage main banner, upload pictures and edit content with a toolbar and preview, all inside Merchant Center (Content app).

| # | Task | Verified |
|---|---|---|
| [x] T20.1 | Media library on the commercetools CDN: `npm run ct:media-library` creates product type `cms-media` and the never-published product `cms-media-library`; images uploaded to it get public CDN URLs (`images.us-east-2.aws.commercetools.com`) | second run creates nothing; test upload 1792 × 1024, public 200 |
| [x] T20.2 | Banner block (`type: "banner"`, placement `home.hero`): headline, text, picture + optional phone picture, picture description, text colour, two buttons; `startsAt`/`endsAt` schedule on every block; validation in `sync-content.ts` and the app; only media library hosts allowed | `content/blocks/home-hero-amphibious.json` synced |
| [x] T20.3 | Storefront hero (`HeroBanners`): full-width picture through the image optimizer (`<picture>` for the phone picture), high fetch priority, readable wash, slider when several are live; the old hero stays as fallback | desktop and 375 px, no sideways scroll |
| [x] T20.4 | Content app: Banner editor; media library dialog (grid, Upload, drag and drop; WebP and large pictures converted to JPEG at most 2400 px wide in the browser); upload through the Merchant Center API proxy to the product image endpoint | Chrome: WebP uploaded → `hero-excavator-mSLERNdl.jpg` on the CDN, filled into the field (reverted, not saved) |
| [x] T20.5 | Markdown editor for blocks and pages: toolbar (bold, italic, heading, lists, link, table, image from the media library), Ctrl/Cmd+B/I/K, live preview with the storefront's Markdown library; storefront renders content images (https only, lazy) | Chrome: Bold inserted at the cursor, preview updated (reverted) |

Notes:
- The commercetools image upload takes JPEG, PNG and GIF only (WebP answers 400), hence the in-browser conversion.
- The app now asks for `view_products`/`manage_products`: re-check the app's permissions when registering it for production (T9.5).
- `getImageProps` ignores `priority`; the first banner sets `fetchPriority="high"` itself.
- Review fixes: media URLs are parsed and limited to this project's CDN folder (`src/lib/media.ts`, same rule in next.config and the Content app); Markdown pictures from other hosts are dropped; a banner without a valid picture no longer removes the default hero; unparseable schedule dates hide the block; the media product is skipped by product pages, search and sitemap even if published; an upload finds its own image by file name.
- Permissions: the Content app's Manage permission now includes `manage_products` (needed for uploads through the Merchant Center proxy), so give it only to people who may edit products. Least-privilege alternative: upload through a storefront endpoint that checks the Merchant Center token (like `/api/revalidate`) and writes only to the media product.
- Never delete or publish the `cms-media-library` product: deleting it breaks every uploaded picture.
- Media library delete (T20.6): Delete on each image; refused while a block or page still mentions the image's URL ("still used in Block home-hero-amphibious"), otherwise confirmed, then `removeImage` on the media product (version re-read, one retry on conflict). Tested in Chrome: the unused test upload was deleted, the banner image refused.

## E21 Store chrome fixes ✅
| # | Task | Verified |
|---|---|---|
| [x] T21.1 | Logo always reloads the homepage (`SiteLogo`: plain link, like Magento) | click on `/` reloads the page |
| [x] T21.2 | Guests: the top bar says "Welcome to Ironline Supply" at every width (the guest badge; the right-hand welcome is for signed-in customers) | browser |
| [x] T21.3 | Sign-in, registration and password pages keep the store header and footer (`SiteChrome`, shared with `(shop)`); Magento "Customer login" with Registered / New customers columns | browser |
| [x] T21.4 | Checkout in its own route group `(checkout)`: logo, Secure checkout, Back to cart; no search, menu, mini-cart or footer | guest and consumer checkout; saving a method still updates totals |
| [x] T21.5 | Product page: the gallery card no longer stretches to the details column (`items-start`) and stays in view while the details scroll | `/p/u123-qr`: 25 px padding below the thumbnails |

Notes:
- Every page now has one `<main>` landmark (SiteChrome, cached guest layout, checkout layout).
- Sign-in pages use `SiteChrome lenient`: a redirect from the buying context (unreadable session, `/no-access`) falls back to the guest header instead of looping.

## E22 Purchase lists (Magento B2B "Requisition lists")
**Goal:** signed-in buyers and consumers keep named lists of products they reorder; they add to a list from the product page, the cart and quick order, edit quantities, and add selected lines or the whole list to the cart at the current unit's prices.
**Acceptance:** as Sofía, create "Monthly filters"; on the Air Filter page "Add to purchase list" ×10, again → 20; "Save cart to purchase list" makes a list with the cart's lines; quick order "Add to purchase list" saves valid lines and reports bad SKUs; on the list page change a quantity, remove a line, add selected lines or all to the cart (Spain prices; machines go in "for quote", unsold SKUs reported); rename and delete work; another customer's list id answers 404.

Design: personal lists through the customer token: `/in-store/key={store}/me/shopping-lists` with `manage_my_shopping_lists:{project}:{store}` (per store; the storefront client already holds it for all 5 stores, project-wide is refused). commercetools enforces ownership and store. Stored lines have no SKU or price: reads expand `lineItems[*].variant`, prices come from a price-selected product query for the current unit, and "add to cart" goes through the quick-order path (re-priced, unsold reported, machines for quote). Lists are kept 3650 days (project default 360). `/me` lists can't carry a business unit, so company-shared lists (Phase B) would need as-associate, new role permissions on the project-wide roles and the admin client: deferred.

| # | Task | After | Files | Verify |
|---|---|---|---|---|
| [x] T22.1 | `customerScopes()` adds `manage_my_shopping_lists:<p>:<store>` per store | none | `src/features/auth/session.ts` | Sofía's password-flow token is granted it; old sessions sign out once |
| [x] T22.2 | Service: my lists (paged), get, create (name, lines by SKU, 3650 days), rename, delete, add lines, set quantities / remove; 409 re-read once | T22.1 | `src/features/purchase-lists/{types,service,utils}.ts` | script with Sofía's token: create, add, re-add merges, rename, delete; foreign id → 404 |
| [x] T22.3 | Line pricing for the context (name, price, slug, image, quote-only, sold or not) | none | `src/features/catalog/service.ts` | € prices for Spain |
| [x] T22.4 | Entry points: create, rename, delete, add to list (from PDP / cart / quick order), update lines, add selected or all to cart | T22.2, T22.3 | `src/features/purchase-lists/actions.ts` | gates |
| [x] T22.5 | Pages `/account/purchase-lists` and `/account/purchase-lists/[id]` + nav link | T22.4 | `src/app/(shop)/account/purchase-lists/**`, components | browser |
| [x] T22.6 | "Add to purchase list" on the product page, "Save cart to purchase list", quick order "Add to purchase list" | T22.4 | components in `features/purchase-lists`, `ProductView`, `CartView`, `QuickOrderForm` | browser |
| [x] T22.7 | Docs | all | `CLAUDE.md`, this section | review |
| [ ] T22.8 | *(Phase B, deferred)* company-shared lists via as-associate + role permissions | | | |

Notes:
- Live data: no shopping lists yet; no associate role has shopping-list permissions (not needed for `/me` lists); project retention 360 days.
- Decisions: consumers get lists, guests don't; machines from a list go into the cart "for quote" like quick order.
- T22.3 landed in `lookupSkus` (`features/cart/service.ts`, now with price, slug and image) instead of the catalog service, so lists and quick order price lines the same way.
- Built and checked in the browser as Sofía: created "Monthly filters"; Air Filter ×10 twice from the product page → 20; quick order saved 3 products into a new list and reported "Not found: no-such-part"; on the list page a quantity change and a removed line saved; "Add selected" put 6 oil filters in the cart, "Add all" the rest (15 items, €580.00); "Save cart to purchase list" made a 2-line list and left the cart alone; rename and delete (with a confirm step) worked. A script with Sofía's token showed the same-variant merge, and that a foreign id or another store's list reads as not found.
- Review fixes: Enter in the quick-order list fields saves to the list (it used to add to the cart); "Add all to cart" adds at most 100 products per click (the quick-order limit) and says so; adding a list to the cart is rate-limited and its errors are handled; the list picker resets after a new list is made, so a second click doesn't create another; sign-out redirects from expired or narrowed tokens are no longer swallowed; delete shows errors; a merged quantity can't go over 9999; a saved rename closes the form; SKUs in links are encoded. Left as is: the 50-list cap isn't atomic (soft limit), and a save from a very large cart sends one long SKU query.
- Surprises: adding a variant already on a list merges quantities (no second line); quantity 0 removes the line; sessions from before T22.1 lack the scope and sign out once.

## E5 Approval rules (Magento B2B "Approval rules" / "Order approvals")
**Goal:** company admins define approval rules (e.g. order total above a threshold needs an approver); a buyer's matching order becomes a pending approval; approvers approve or reject; buyers see the status.
**Acceptance:** with the seeded rule active, Sofía's €10,000+ LiftTech Soluciones order shows "Pending approval" on My orders and the order page, and a Pending flow exists for it; Carlos approves it on `/account/approvals` → Sofía sees "Approved"; a second one rejected with a reason → "Rejected: <reason>", order Cancelled; an order under the threshold is placed as before with no flow; Sofía can't open `/account/approvals` or the rules page.

Design: orders, flows and rules go through the admin client's **as-associate** endpoints (`as-associate/{associateId}/in-business-unit/key={unit}/…`), only after an ownership read with the buyer's token and a live `hasPermissionNow` check; the associate id always comes from the session. The customer token stays narrowed. commercetools enforces the associate's own permissions and approver tiers on top. An Order exists (Open) from creation; "pending" lives on its Approval Flow.

Decisions (defaults, revisit if needed): a rejected order is cancelled automatically; an approved order stays Open; associate roles unchanged; self-approval blocked in the app; quote orders decided after T5.2.

| # | Task | After | Files | Verify |
|---|---|---|---|---|
| [x] T5.1 | `ct:seed-approval-rules -- [--bu key] [--threshold 10000] [--inactive]`: idempotent rule `orders-over-10000` in `lifttech-solutions-ltd-es` (as-associate with an approver): `totalPrice.centAmount > N*100 and totalPrice.currencyCode = "EUR"`, requesters `buyer`, one tier `approver or admin` | none | `scripts/seed-approval-rules.ts`, `package.json` | first run "+ Orders over €10,000 (Active)", second "unchanged" |
| [x] T5.2 | Spike (sandbox): which order paths create a flow (customer `/me/orders`, admin in-store, admin as-associate, as-associate from quote); order state after reject; inherited admin approving; self-approval; flow query by order id | T5.1 | scratch script; findings below | findings table here |
| [x] T5.3 | `asAssociate(customerId, businessUnitKey)` helper (admin; only after ownership read + live permission check; ids from the session) | none | `src/lib/commercetools/client.ts` | typecheck |
| [x] T5.4 | Keep placing orders with the buyer's token (the spike showed every path creates the flow); after placing, look up the order's flow; `?approval=pending` notice | T5.2, T5.3 | `src/features/checkout/*` | under threshold as before; over → Pending flow |
| [x] T5.5 | Approvals reads: types, labels, eligibility, pending flows for an approver, flows for my orders | T5.3 | `src/features/approvals/*` | Carlos sees 1 pending; Sofía's order maps to Pending |
| [x] T5.6 | Approve / reject actions: rate limit, live `UpdateApprovalFlows`, fresh read + version, self-approval guard, reason for reject, 409 → "already handled", Rejected → cancel order | T5.5 | `src/features/approvals/*` | approve → Approved; reject → Rejected + Cancelled |
| [x] T5.7 | Approver UI: `/account/approvals` (Pending / All) and `/account/approvals/[id]` (order, matched rule in words, Approve / Reject with reason) | T5.5, T5.6 | `src/app/(shop)/account/approvals/**`, `src/features/approvals/components/*` | browser as Carlos; Sofía refused |
| [x] T5.8 | Buyer status on My orders, the order page and the checkout result | T5.4, T5.5 | `src/features/orders/*`, `src/app/(shop)/account/orders/**` | browser as Sofía |
| [x] T5.9 | Approval rules list (company area): condition in words, requesters, approvers, Active/Inactive | T5.3 | `src/features/company/*`, `src/app/(shop)/account/company/approval-rules/page.tsx` | Oliver sees the seeded rule |
| [x] T5.10 | Rule create / edit / deactivate: predicate built server-side from a validated amount and the unit's currency (no raw predicate input) | T5.9 | `src/features/company/*`, `approval-rules/new`, `approval-rules/[id]` | Oliver creates a rule; buyer refused |
| [x] T5.11 | Account navigation and dashboard counts for approvals and rules | T5.7, T5.9 | `src/features/account/components/*` | links per role |
| [x] T5.12 | Notification emails through the dev mailer (approvers on a new flow, buyer on the result) | T5.4, T5.6 | `src/features/approvals/*` | dev log shows the emails |
| [x] T5.13 | Quote orders: nothing to change. The admin order-from-quote path also creates the flow when the rule matches, so quote orders need approval too (like Magento); their status shows like any order (T5.8) | T5.2 | none | spike path (b) |
| [~] T5.14 | Docs and end-to-end browser run (docs done; browser run needs the demo users' sign-in) | all | `docs/decomposition.md`, `CLAUDE.md` | acceptance above |

Notes:
- T5.2 spike findings (rule lowered to > €1 for the run, restored; the 4 test orders cancelled):

  | Question | Result |
  |---|---|
  | Order paths that create a flow | **All**: customer token `/in-store/me/orders`, admin `/in-store/orders`, admin as-associate orders. The flow exists right after the 201 (status Pending). |
  | Order while pending | A normal Open order; the status lives only on the flow. |
  | Reject | Flow `Rejected` with `rejection.reason`; the order **stays Open**, so the app cancels it. |
  | Approve by inherited admin (Oliver, admin of the parent) | Allowed; flow `Approved`, order still Open. |
  | Buyer approving | Refused: `AssociateMissingPermission` (needs UpdateApprovalFlows). |
  | Queries | `order(id in (...))` and `expand=order` work; flows carry `eligibleApprovers`, `currentTierPendingApprovers`, `rules`, `approvals`. |
- Built (service-level script against the sandbox): three €10,500 orders for Sofía matched "Orders over €10,000"; Sofía sees "Pending approval"; Carlos's inbox lists them; Sofía is refused on the approvals list, on deciding and on the rules page; a stale version and a second decision are refused; approve → Approved (order stays Open, buyer emailed); reject with reason → Rejected, order Cancelled, buyer emailed with the reason. Demo data left: order 098D3A1F (PO APPROVAL-DEMO-3) waiting for approval, 16FB83F1 approved, FD404292 rejected.
- Approval flows for orders cancelled elsewhere stay Pending in commercetools: the inbox labels them "Order cancelled" and refuses a decision. The two left by the spike were closed.
- Review fixes: a failed cancellation after a reject no longer loses the rejection: the approver sees "Retry cancellation" and the order page says the cancellation is pending; an unknown decision value is refused (no default to approve); the buyer email is awaited; rules the form can't represent (custom predicate, several steps) can't be overwritten by the edit action; switching a rule off or renaming it works even if its roles changed; a rule needs at least one person in the unit who holds an approver role; the permission check comes before any other call; the amount is validated again on the server.
- Open: approvers are emailed only for orders placed at checkout, not for orders from quotes or reorders (those still get the flow and show in the inbox).
- Browser check as Carlos (approver): Order approvals listed 098D3A1F (Sofía López, Orders over €10,000, €10,500.00, Pending approval); the review page showed rule, approver roles, items and totals; Approve → "Approved by you", the Waiting list emptied, the order stayed Open, and Sofía's "approved" email appeared in the dev log. Approval rules also opens for Carlos (the sample Approver role holds CreateApprovalRules).
- Fixed on the way: table scroll boxes are now `relative`, so the screen-reader-only "Actions" header no longer made narrow pages scroll sideways (approvals list was 687 px wide in a 473 px window).
- Browser check as Sofía (buyer): My orders shows "Approved" next to 098D3A1F and 16FB83F1, "Rejected" next to the cancelled FD404292, and no badge on her orders under €10,000; the order pages show who approved or rejected and the reason; the menu has no approval links, and /account/approvals, an approval page and /account/company/approval-rules all send her back to My account. (Fixed: a stray full stop after a rejection reason that ends with one.)
- Still to check in the browser: Oliver editing a rule.
- Project-level `/approval-rules` and `/approval-flows` answer 404: they exist only under as-associate. There are no rules or flows yet.
- Roles already fit: approver and admin hold UpdateApprovalFlows / CreateApprovalRules / UpdateApprovalRules; buyer holds CreateMyOrdersFromMyCarts. Approver and admin have no My* cart or order permissions (they can't buy).
- Rules can't be deleted, only set Inactive. Spain totals include VAT.

## E6 ERP connector (ties into dominate-erp-connector)
- Import API: products, prices, stock from the ERP into commercetools.
- Subscription on `OrderCreated` → queue → worker → ERP.
- API Extension for a credit-limit check at checkout.
- Package as a **commercetools Connect** app.
