# Changelog

## v1.3.0 (2026-10-29)

Company tier prices and B2C customer-group prices, the pricing model of an ERP-driven B2B shop on commercetools Standalone Prices.

**Live demo:** https://forgeline-storefront-gamma.vercel.app

### Highlights

- **Tier prices:** a company's own price list can have quantity breaks. Buyers see them on the product page, on product cards and in the cart, and the cart prices each line at the tier its quantity reaches.
- **Customer-group prices:** consumers in a customer group (for example trade members) get their own B2C prices. Everyone else, guests included, keeps the public price.

### Pricing

- Product page: each quantity break under the price ("Buy 10 for $36.00 each and save 10%").
- Category, search and homepage cards: "As low as" with the lowest tier price.
- Cart and minicart: the unit price for the line's quantity; the cart also shows the next break ("Buy 50 for $32.00 each").
- Signed-in consumers are priced with their customer group. A group change made in Merchant Center or by a sync shows within a minute.
- SKUs without a group price fall back to the public price; product discounts apply on top of group prices.
- The search index is kept per customer group, so search results show the visitor's own prices.
- Guests and the cached guest pages are unchanged.

### Under the hood

- Pure tier helpers in `features/catalog/tiers.ts` (price ladder, unit price at a quantity, next break, lowest price, saving), with unit tests (59 tests in total).
- `priceCustomerGroup` in the shared price selection; `customerGroupId` on the consumer's buying context.
- Proof-of-concept scripts, dry run by default, idempotent, with `--remove` to undo:
  - `npm run ct:tier-prices`: quantity breaks on one company's channel.
  - `npm run ct:customer-group-prices`: a `trade-members` group with its own prices; `--assign <email>` adds a consumer.
- Both scripts have a `--check` mode that asks commercetools how it picks prices (channel fallback, tiers in a cart, tiers with a product discount, a group member's cart) and deletes every temporary row and cart it creates.

### Known limitations

- A cart created before a customer joins a group keeps no group: commercetools sets it when the cart is created, and the `/me` cart API can't change it.
- With an active product discount, the discounted price applies at every quantity and tier prices are ignored.
- Prices are loaded by scripts in this release; a nightly import from an ERP through the Import API is planned.

## v1.2.0 (2026-10-27)

Security hardening for sign-in, password reset and content links, and one page message style across the shop.

**Live demo:** https://forgeline-storefront-gamma.vercel.app

### Highlights

- **Page messages:** every success, error and warning uses one message style (tinted background, coloured text, an icon per type). Form results show in the message bar at the top of the page instead of next to the form.
- **Sign-in protection:** parallel guessing can no longer get past the sign-in limits, and strangers can't lock a buyer out of their account.

### Messages

- Form results at the top of the page: sign-in, register, password reset, account information, addresses, company profile and users, approval rules, quotes, approvals, checkout and purchase lists.
- Messages can carry a link to a page of the shop ("You added Air Filter to your shopping cart. View cart").
- New messages: "Thank you for registering with Ironline Supply." after sign-up and "You are signed out." after sign-out.
- Notices that belong to a page (order placed, password changed, confirm your email, quick-order results) use the same style.

### Security

- Sign-in attempts are counted before the password is checked, so a burst of parallel requests can't get past the limit. A successful sign-in doesn't count.
- A browser that signed in to an account before skips the per-email limit (sealed `ct_device` cookie), so failed attempts from elsewhere can't lock the owner out.
- Only the newest password reset link works: requesting a new one cancels the older ones.
- Content links and merchants' redirects must stay on the site as a browser reads them, so `//host`, `/\host` and `/<tab>/host` are refused.

### Fixes

- Quick order: a SKU on several lines can no longer add up to more than 9,999.

### Under the hood

- Unit tests for the sign-in limiter, the login limits, same-site paths, page messages and the quick-order quantity check (51 tests).

## v1.1.0 (2026-10-27)

Clean URLs, a blog and editable content pages in Sanity, ajax layered navigation, and an upgrade to Next.js 16.

**Live demo:** https://forgeline-storefront-gamma.vercel.app

### Highlights

- **Clean URLs:** categories by their tree path (`/excavators/wheeled-excavators`), products and content pages at the root (`/jj234-wx`), filters in the query string. Old `/c/`, `/p/` and `/pages/` addresses and other spellings redirect permanently.
- **Sanity for content:** an embedded Studio at `/studio` for content pages and the blog, with live preview and click-to-edit. CMS blocks (banners, widgets) stay in commercetools.
- **Blog:** posts, categories, tags, RSS feed and structured data. Editors place commercetools products in a post, and each visitor sees their own price.
- **Layered navigation:** filter, sort and page a category without a full page reload, with a price slider.
- **Next.js 16** with React 19.3 and Turbopack builds.

### Shopping

- Header minicart: a dropdown with the cart lines, quantity steppers that save on their own, remove with a confirmation step, subtotal and checkout.
- Page messages for cart changes ("You added Air Filter to your shopping cart.") at the top of every page.
- Homepage "Machines" and "Spare parts" carousels.
- Layered navigation: price slider, child categories, mobility, model, colour, certification and capacity filters; filter groups that can't narrow the list are hidden; works without JavaScript too. Filtered views are kept out of search results.

### Content and URLs

- Content pages (About us, Delivery information, Terms) are edited in Sanity once a project is configured, and fall back to commercetools Custom Objects without one. `npm run ct:sanity-content` imports them, with a demo blog post.
- Rich text with images, links, tables and product cards.
- A commercetools product picker in the Studio: search by name or SKU; only the SKU is stored, so prices stay live.
- URL index with clash detection and merchant-defined redirects: `npm run ct:urls` lists every URL and adds or removes redirects.
- Blog pages: `/blog`, `/blog/<post>`, `/blog/category/<slug>`, `/blog/tag/<tag>` and `/blog/rss.xml`, in the sitemap and the footer.

### Under the hood

- Next.js 16: `middleware.ts` became `proxy.ts`, ESLint flat config, and fixes for the new React Compiler lint rules.
- Drafts never reach shared caches; published Sanity reads go through the server memo and refresh on `POST /api/revalidate`.
- Prettier and `.editorconfig` (2 spaces, width 140).
- CI runs on Node 24 with npm 11.

### Fixes

- Content pages returned 404 to guests on the cached pages; Sanity reads now work inside them.
- Links in rich text reject `/\` addresses that browsers read as another site.

### Setup for upgraders

- Optional Sanity variables: `NEXT_SANITY_PROJECT_ID`, `NEXT_SANITY_DATASET`, `SANITY_API_READ_TOKEN` (and `SANITY_API_WRITE_TOKEN` locally for the import). See `.env.example`.
- In Sanity, add the shop's address as a CORS origin with credentials allowed, so the embedded Studio can sign in.

## v1.0.0 (2026-10-26)

The first public release of **Forgeline**: an open-source B2B and B2C storefront for commercetools, built with Next.js 15 (App Router) and the official commercetools TypeScript SDK.

**Live demo:** https://forgeline-storefront-gamma.vercel.app (the demo shop, Ironline Supply, runs on the commercetools B2B sample data)

### Highlights

- B2B features on commercetools: company accounts, quick order, quotes, approval rules and purchase lists
- One storefront for business buyers, consumers and guests
- Fast on Vercel's free tier: cached catalog pages, server code next to the commercetools region
- Spam protection without CAPTCHAs, security headers and least-privilege customer tokens
- Unit and browser tests with CI on every push

### For business buyers (B2B)

- **Company accounts:** buyers sign in as associates of a business unit and switch between the units they belong to.
- **Company prices:** each unit buys from its own store and distribution channel, in its own currency.
- **Quick order:** paste SKUs and quantities, or pick from a catalog table; unknown SKUs are reported.
- **Purchase lists**: save products you reorder; add one, a selection or a whole list to the cart.
- **Quotes:** machines go into the cart "for quote"; request, negotiate and order from an accepted quote.
- **Approval rules:** orders above a threshold wait for an approver; approve or reject with a reason; the buyer is notified.
- **Company area:** profile, users, roles and permissions, structure, approval rules and company orders, shown by role.
- **User invitations:** admins invite existing customers by email; the invitee accepts with a one-time link.
- **Order on invoice** with a purchase order number.

### For consumers and guests (B2C)

- Browse, search with autocomplete and typo tolerance, and fill a cart without an account.
- Sign up, verify email, reset a password and keep an address book.
- One-page checkout: shipping address, shipping method, payment.
- A guest cart is merged into the account cart on sign-in and re-priced.

### Storefront

- Product pages with an image gallery, variants, live stock, specifications, compatible spare parts and related products.
- Category menu that mirrors the Merchant Center tree, with dropdowns and flyouts.
- My account: dashboard, orders, quotes, purchase lists, addresses and account information.
- Homepage banners, info blocks, featured products and static pages, edited in the **Content** app inside Merchant Center (runs on commercetools Connect), with image uploads and a Markdown editor.

### Performance

- Guest catalog pages are pre-rendered and refreshed automatically when products or content change.
- Vercel functions run in Cleveland (`cle1`), next to commercetools' AWS us-east-2: API calls take milliseconds instead of hundreds.
- Shared data is read once per page render (React `cache()`), and independent commercetools calls run in parallel: signed-in company pages are 2 to 2.5 times faster.
- Small pages: about 19 KB for the homepage and 103 to 117 KB of JavaScript per page.

### Security and spam protection

- Security headers on every response: frame protection, CSP basics, HSTS, nosniff, referrer and permissions policies.
- Customer tokens are limited to "my" scopes per store; admin credentials never reach the browser.
- Encrypted session cookies (AES-256-GCM); logout protected against cross-site requests.
- Every company, approval and quote write re-checks permissions live.
- Spam protection on sign-in, sign-up, password reset and checkout: Vercel BotID, a honeypot field and a time check.
- Rate limits shared across all server instances through Upstash Redis (in memory when Redis is not configured); sign-in counts failed attempts only.
- Messages that don't reveal whether an email has an account.
- Kept out of search engines by default (`SITE_INDEXABLE`).

### Developer experience

- Feature-based structure (`src/features/<domain>`), thin route pages, Server Actions as the only public entry points.
- Idempotent setup and seed scripts (`npm run ct:*`).
- Vitest unit tests (`npm test`), read-only Playwright browser tests (`npm run test:e2e`), and GitHub Actions CI (typecheck, lint, unit tests).

### Configuration

See `.env.example` and the README. Production needs:

- the commercetools admin and storefront API clients (`CTP_*`);
- `SITE_URL`, the public address of the shop.

Optional:

- `REVALIDATE_SECRET` for instant cache refresh;
- Upstash Redis for shared rate limits;
- `SITE_INDEXABLE=true` to allow search engines;
- `B2C_CARD_PAYMENTS` with `CTP_CHECKOUT_APPLICATION_KEY` for card payments.

### Known limitations

- Card payments through commercetools Checkout are built but off by default; consumers pay by bank transfer.
- No production email provider yet: account emails are printed to the server log in development.
- Purchase lists are personal; company-shared lists are planned.
- Sessions stay valid until their token expires (up to 48 hours) after a password reset.
- The Content app's Manage permission includes catalog write access (`manage_products`).

### Next

- Company-shared purchase lists
- ERP connector (order export, stock and price import)
- Next.js 16 with Cache Components
