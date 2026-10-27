# Changelog

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
