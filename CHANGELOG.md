# Changelog

## Unreleased

Hardening before production: stock, payments, sessions, access checks, speed and resilience.

- **PayPal button straight away:** selecting PayPal opens its Checkout session on its own, so PayPal's button shows without clicking "Continue with PayPal" first. That session doesn't hold the cart: changing the cart, the delivery details or the billing address closes it, and a new one opens for the new total.
- **One switch per payment method:** `B2C_CARD_PAYMENTS`, `CHECKOUT_PAYPAL` and `B2C_BANK_TRANSFER` each offer their own method, so PayPal can run without cards. Bank transfer is no longer offered automatically when cards are off: set `B2C_BANK_TRANSFER=true` to keep it.
- **PayPal ready:** with `CHECKOUT_PAYPAL=true` the checkout lists PayPal as its own payment method next to card, both through commercetools Checkout, and orders, PDFs and emails name PayPal. `B2C_BANK_TRANSFER=true` offers bank transfer as a choice next to it. Not yet run against a real PayPal payment.
- **Stock comes back:** orders we cancel add their stock back, line by line and only once. Unpaid bank transfers can expire (`BANK_TRANSFER_EXPIRY_DAYS`), and guests' unpaid orders are capped.
- **Money is reconciled:** an order's payment state follows what the card payments really did; a wrong amount, or money without an order, raises an alert.
- **Orders use today's prices:** a total that changed since the buyer reviewed it goes back to them instead of being ordered.
- **One-list payment step:** one list of payment methods (card, PayPal, bank transfer, or purchase order for business buyers) with one billing address under it. Consumers and guests can bill to an address other than the shipping one, or to a saved address.
- **Card payments work again:** Checkout refuses Frozen carts ("Unable to proceed with the checkout"), so the cart is no longer frozen while the buyer pays. A payment lock does the job instead: the cart can't change for 30 minutes, cancelling unlocks it, and old frozen carts are unfrozen. The page's security policy now lets Checkout load its stylesheet and fonts, which it needs before it shows any payment method. In development, Checkout's messages are logged in the browser console.
- **Card payments:** stock is checked before paying, two tabs share one session, and a cart with a running payment can't be reopened.
- **Sessions:** signing out ends that session even if a cookie was copied, sessions end 90 days after sign-in at the latest, buyers can change their password, and new passwords are checked against known breaches. Production needs `SESSION_SECRET`; the cookie is renamed `__Host-ct_session`, which signs everyone out once.
- **Least privilege:** customer tokens only carry the stores of the customer's own units; quote actions check permissions live; who may order follows the permission, not the role's name.
- **Performance:** a customer's units come from one query instead of loading every unit, price messages expire only prices and are debounced, catalog walks no longer stop at 10,000 products, category lists cache less, search typo checks are remembered per search, purchase lists load when the panel opens.
- **Resilience:** every commercetools call has a timeout, reads are retried, the proxy can't hang on the URL index, and production refuses to start with missing configuration.

## v2.1.0 (2026-11-06)

Checkout you can run a business on: every order is numbered, has a payment record and sends one confirmation email, even when the buyer closes the tab right after paying. Card payments charge exactly the total the buyer reviewed, stock is reserved when an order is placed, and buyers can enter discount codes. Plus a proof of concept for company prices that come from an external price service.

**Live demo:** https://forgeline-storefront-gamma.vercel.app

### Highlights

- **Order numbers:** every order gets a readable number (`ORD-2026-000123`) the moment it is placed, on every path: invoice + PO, bank transfer, card payment and order from a quote.
- **Processing that doesn't depend on the browser:** numbering, the payment record and the confirmation email run on the server, from the order itself, from a commercetools Subscription and from a sweep, so nothing is lost when a buyer closes the tab.
- **One confirmation email per order:** items, totals, delivery address, how to pay, and a link to the order for signed-in buyers.
- **The charged total is the reviewed total:** paying by card locks the cart until the payment ends.
- **Stock reserved on order:** an order that can't be filled is refused with the SKUs named, instead of being oversold.
- **Discount codes** on the cart page.

### Checkout and orders

- Invoice and bank-transfer orders get a commercetools Payment (method `invoice` or `bank-transfer`, planned amount = the order total) and the payment state Pending, so finance can reconcile them alongside card payments.
- A rejected order no longer waits for payment: when the approver rejects it, the order is cancelled, its payment state becomes Failed and its Payment is marked cancelled.
- Paying by card locks the cart (a commercetools Frozen cart). Changes from another tab are refused with a message; "Cancel payment and change my cart" unlocks it, and an abandoned payment unlocks after 30 minutes.
- When commercetools Checkout's script can't load (blocked or offline), the buyer sees "Card payment is unavailable" with Try again instead of an empty payment area; the message goes away if the script arrives late.
- Checkout preselects the right saved address when two share a street, and the right delivery method when two have the same name.
- Placing a business order and ordering from a quote are rate limited, like the consumer order actions.
- Orders placed before this release keep showing the first 8 characters of their id.

### Cart

- Discount codes: apply and remove on the cart page, with a clear message when a code doesn't apply (expired, not valid for these items, can't be combined). A discount on the cart total shows as its own row in the summary, the order page and the PDFs.
- Cart lines come from the store's warehouse (supply channel) and new carts reserve stock on order (`ReserveOnOrder`). Out-of-stock messages name the SKUs, on checkout, bank transfer and order from a quote.

### Company prices from an external price service (proof of concept)

- For suppliers whose company prices are calculated in an ERP and can't be stored as commercetools price lists: units of a store marked `externalPricing` see their company's price ladders, read from a price service and laid over the cached web prices. Carts get the same prices from an API Extension (`POST /api/price-extension`, `PRICE_EXTENSION_SECRET`), which refuses the cart change when the price service fails rather than charging the web price.
- Money with more than 2 decimals (ERP unit prices) is shown precisely.
- `npm run ct:nz-trade` loads the demo slice, units, prices and the extension (dry run by default). Design and setup: `docs/nz-trade-pricing.md`. Not yet run against the demo project.

### Under the hood

- `src/features/order-processing`: order numbers from a per-year counter, per-order step markers so each step runs once (also when the order action and the Subscription handle the same order at the same moment), Payments keyed `order-<order id>`, the confirmation email built from the order document. The sweep pages through every order of the last 24 hours (up to 2,000 per run). Pure parts unit-tested.
- New endpoints: `POST /api/order-events` (the Subscription's queue, `ORDER_EVENTS_SECRET`) and `GET /api/cron/order-sweep` (`CRON_SECRET`). Both refuse every caller while their secret is unset.
- New scripts: `npm run ct:order-subscription` (order and payment messages to EventBridge or Pub/Sub) and `npm run ct:nz-trade`.
- Opt-in browser tests that place real orders (`E2E_ORDERS=1`, `e2e/orders`): guest and consumer bank transfer, invoice with a PO, an order above the approval rule that the approver rejects, and the card lock with Checkout stubbed out. They order from their own test cart, cancel their orders and put the stock back.
- `npm run setup -- --check` now says that missing or extra scopes need a new API client (commercetools can't change an existing client's scopes).
- CMS blocks with start and end dates no longer break the prerendered pages.
- 285 unit tests.

### Upgrading from 2.0

- **Runtime API client:** the shop now needs `manage_payments`. Create a new API client with the 16 runtime scopes (`RUNTIME_SCOPES` in `src/lib/commercetools/scopes.ts`), put it in `CTP_CLIENT_ID` / `CTP_CLIENT_SECRET`, and delete the old one. `npm run setup -- --check` confirms it.
- **New settings** (see `.env.example`): `ORDER_EVENTS_SECRET` and `CRON_SECRET` (at least 32 random characters each), optional `ORDER_NUMBER_PREFIX` (default `ORD`), and `PRICE_EXTENSION_SECRET` only for the price service POC.
- **Email:** set `RESEND_API_KEY` and `MAIL_FROM` in production, or confirmation emails are only printed to the log.
- **Order events:** turn on Messages in the project settings, then run `npm run ct:order-subscription -- --eventbridge <aws-account-id> --yes` and point the queue at `/api/order-events`. Steps: `docs/checkout-setup.md`.
- **Sweep:** schedule `GET /api/cron/order-sweep` every 15 minutes. Vercel's Hobby plan allows only daily crons, so use a paid plan or an external scheduler; `vercel.json` has no cron entry yet.
- Carts created before the upgrade don't reserve stock; new carts do.

### Known limitations

- A real card payment hasn't been tested end to end: the demo project's Checkout Application has no payment methods. The card lock and cancel are tested with Checkout stubbed out.
- Order numbers can have gaps (a number is used up when two orders race for it, and test orders use them too).
- The 30-minute card lock counts from when the cart was locked, not from the Checkout session; a buyer still typing card details after 30 minutes can have the cart unlocked from another tab (the order is then flagged if its total differs).

## v2.0.0 (2026-10-30)

Fast pages for every visitor, content in Sanity, CSV ordering and a one-command setup. The storefront now serves cached pages to signed-in buyers too, with their own prices streamed in.

**Live demo:** https://forgeline-storefront-gamma.vercel.app

### Highlights

- **Fast for everyone:** every catalog, content and blog page is a prerendered shell served from the CDN (Next.js 16 Cache Components), for guests and signed-in buyers alike. Product names, pictures and category headings arrive with the first byte (about 0.1 s from Asia); each visitor's prices, cart and account stream in right after. Before, only guests on plain URLs got a cached page; filtered URLs, variants and every signed-in page rendered per request (0.4 to 1 s to the first byte).
- **One-command setup:** `npm run setup` takes a commercetools project with the B2B sample data to a running demo shop: `.env`, both API clients (the storefront client with exactly the 14 scopes it needs), demo sign-ins and demo data. `--check` reports without changing anything.
- **CSV order upload:** buyers upload a spreadsheet on Quick order (any column layout, Excel's semicolons included); the lines go to the cart or a purchase list after the usual checks. A template is included.
- **Content in Sanity:** pages, banners, blocks and a blog, edited in a Studio built into the storefront at `/studio`, with live product cards and preview.
- **Company-shared purchase lists:** lists the whole company sees, with view and edit rights per role.
- **Order documents:** order confirmation and invoice PDFs, and order history as CSV (own or company-wide).

### Speed

- Shared data is cached with tags and refreshed on change: `POST /api/revalidate` (the Sanity webhook, `npm run ct:revalidate`, an optional catalog Subscription) expires exactly what changed; otherwise content refreshes within a minute and prices within 15 minutes.
- Catalog reads take only a pricing key (store, channel, currency, country, customer group), so cached data is shared per price list and never holds anything about the person.
- Links prefetch each page's own shell: a click shows the product's name and pictures at once.
- Signed-in pages: connections to commercetools kept open, secondary parts streamed, the purchase-list picker in one round of calls, a new device's cart remembered instead of searched on every page.
- Images cached for 30 days, generated only at the widths the pages use.

### Security

- Account, cart, checkout and sign-in pages render per request with a fresh Content-Security-Policy nonce; cached pages get a fixed policy.
- A password reset ends every existing session; sign-up no longer reveals whether an account exists.
- Sessions last 30 days from the last visit (refresh tokens), and sign-out revokes them.

### B2B and B2C

- Quick order: CSV upload; the catalog table now shows trade members their own prices.
- Category filter by child category works again (it was ignored since layered navigation was added).
- Every private page has its own title (Sign in, Shopping cart, Checkout, My orders, ...).

### Pricing

- Tier prices on all 11 spare parts (every one except the pneumatic tire) for three price lists: Eagle Heavy Lift's company list (10% and 20% off), the public B2C list for guests and consumers (5% and 10% off), and the `trade-members` customer group (10% off, then 15% and 20%).
- The tiered spare parts are out of the "5 EUR off on all spare parts" discount, because a product discount replaces tier prices in commercetools; the pneumatic tire keeps it.
- `npm run ct:tier-prices` sets the public B2C tiers too and adjusts the discount (`--remove` restores it); `npm run ct:customer-group-prices` gives the group's rows their own tiers. The SKUs and break quantities are listed once in `scripts/poc-prices.ts`.

### Fixes

- A link to an old URL in CMS content made the browser re-request it endlessly after a client-side navigation; CMS links no longer prefetch, and redirects keep real 307/308 status codes.
- A second cache refresh within 10 seconds was ignored, so a change in a price import could stay stale for 15 minutes.

### Under the hood

- Two root layouts: `(shop)` (prerendered) and `(private)` (per request); the separate guest copies are gone.
- New scripts: `npm run setup`, `ct:price` (show or set one standalone price), `ct:revalidate`.
- Browser tests for signed-in buyers, approvers and admins, the category filter and the prefetch regression (they put back what they create); 177 unit tests.
- MIT license.

### Upgrading from 1.x

- Content moved from commercetools Custom Objects and the Merchant Center Content app to Sanity. Set `NEXT_SANITY_*` (see `.env.example`); without it there are no content pages, blocks or blog.
- Route groups changed: private pages live in `src/app/(private)`, cached pages in `src/app/(shop)`. New private routes must be added to `PRIVATE_SEGMENTS` in `src/proxy.ts`.
- Set `REVALIDATE_SECRET` in your hosting to refresh caches on demand.

### Known limitations

- Card payments through commercetools Checkout stay off by default; consumers and guests pay by bank transfer.
- Category grids and prices stream after the page shell (they depend on the visitor), about 0.5 to 1 s from far away.
- Without the Sanity webhook or a catalog Subscription, changes show within a minute (content) or 15 minutes (prices).

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
