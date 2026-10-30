# Forgeline

[![Next.js 16](https://img.shields.io/badge/Next.js-16-black)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178c6)](https://www.typescriptlang.org/)
[![commercetools](https://img.shields.io/badge/commercetools-Composable%20Commerce-f7b500)](https://commercetools.com/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind%20CSS-v4-38bdf8)](https://tailwindcss.com/)
[![GitHub stars](https://img.shields.io/github/stars/sohelrana09/forgeline-storefront?style=social)](https://github.com/sohelrana09/forgeline-storefront)
[![License](https://img.shields.io/github/license/sohelrana09/forgeline-storefront)](LICENSE)

**An open-source B2B and B2C storefront for commercetools, built with Next.js 16.**

Forgeline is a complete, working online shop on top of [commercetools Composable Commerce](https://commercetools.com/).
One storefront serves three kinds of customers: **business buyers, consumers, and guests**.

It includes the real B2B features merchants expect: company accounts, quick order, quotes, approval rules, purchase lists and store-specific pricing, without any paid frontend platform.

**Key features**

- **One storefront for B2B and B2C:** business buyers, consumers and guests at the same time, each with their own prices, cart and checkout.
- **B2B workflows:** company accounts and roles, quick order with CSV upload, quotes, approval rules, company-shared purchase lists, order documents.
- **Fast for everyone:** pages are cached shells served from the CDN, with each visitor's own prices and cart streamed in (Next.js 16 Cache Components).
- **Secure by design:** narrowed customer tokens, server-only credentials, rate limits and bot checks, a strict Content-Security-Policy on account and checkout pages.
- **Content in Sanity:** pages, banners, blocks and a blog, edited in a Studio built into the storefront.
- **One-command setup:** `npm run setup` takes a commercetools project with the B2B sample data to a running demo shop.

**Live demo:** [Ironline Supply](https://forgeline-storefront-gamma.vercel.app/). Browse the catalog, search and fill a cart as a guest.

To try the business features (company accounts, quotes, approvals, purchase lists), run your own copy: `npm run setup` (see [Quick start](#quick-start)) generates a demo password in `.env.demo` for the sample accounts:
- Buyer: `sofia-lopez@ltsl.com`
- Approver: `carlos-garcia@ltsl.com`
- Company admin: `oliver-smith@ltsl.com`

![Ironline Supply homepage](docs/images/home.jpg)

---

## Contents

- [Who it is for](#who-it-is-for)
- [What your customers can do](#what-your-customers-can-do)
- [What you manage as a merchant](#what-you-manage-as-a-merchant)
- [Screenshots](#screenshots)
- [How it works](#how-it-works)
- [Quick start](#quick-start)
- [Configuration](#configuration)
- [Commands](#commands)
- [Project structure](#project-structure)
- [Roadmap](#roadmap)
- [FAQ](#faq)
- [Contributing](#contributing)

## Who it is for

- **Merchants** who are moving from an all-in-one platform to commercetools, and want to see what a B2B shop on commercetools looks like before they build one.
- **Agencies and developers** who need a reference build: real code for business units, associate roles, standalone prices, quotes and approval flows, not just API examples.
- **Teams learning commercetools**: every feature is mapped to the commercetools API it uses, and the gotchas we hit are written down.

## What your customers can do

### Business buyers (B2B)

| Feature | What it means in practice |
|---|---|
| **Company accounts** | Buyers sign in as associates of a business unit (company or division) and switch between the units they belong to. |
| **Company-specific prices** | Each unit buys from its own store and channel, so it sees its own price list and currency (for example EUR for Spain, USD for the US). |
| **Quick order** | Paste a list of SKUs and quantities, upload a spreadsheet (CSV, with a template), or pick from a catalog table. Unknown SKUs are reported, not silently dropped. |
| **Purchase lists** | Save products you reorder, then add one line, a selection or the whole list to the cart in one click. |
| **Request a quote** | Machines above a set value go into the cart "for quote". Buyers request a quote, negotiate, and order from the accepted quote. |
| **Approval rules** | Orders above a threshold wait for an approver in the company. Approvers approve or reject with a reason, and the buyer is notified. |
| **Order on invoice** | Business checkout with a purchase order (PO) number. |
| **Order documents** | Download an order confirmation or invoice as PDF, and export order history (own or company-wide) as CSV. |
| **Company-shared lists** | Buyers keep purchase lists for the whole company; what colleagues may see or change follows their role. |
| **Company area** | Admins see the company profile, users, roles and permissions, company structure, approval rules and company-wide orders. What each person sees follows their role. |

### Consumers and guests (B2C)

- Browse the catalog, search with autocomplete and typo tolerance, and fill a cart without an account.
- Sign up, verify email, reset a forgotten password, and keep an address book.
- Check out as a guest or a consumer on a one-page checkout: shipping address, shipping method, payment.
- When a guest signs in, their cart is merged into their account cart and re-priced.

### Everyone

- Fast pages for everyone, signed in or not: what is the same for every visitor (header, menu, product names, pictures, descriptions) comes from a cache next to the visitor, and their own prices, cart and account links stream in right after. Changes refresh at once with the Sanity webhook or `npm run ct:revalidate`, otherwise within a minute (content) or 15 minutes (prices and products).
- Product pages with an image gallery, variants (for example model year), live stock, specifications, compatible spare parts and related products.
- My account: dashboard, orders, quotes, purchase lists, addresses and account information.

## What you manage as a merchant

Everything runs on commercetools. There is no second admin to learn.

| You want to change... | Where |
|---|---|
| Products, prices, stock, categories | **Merchant Center** (catalog, standalone prices, inventory). Changes show on the storefront within 15 minutes, or at once after `npm run ct:revalidate` (or automatically with the optional catalog Subscription). |
| Companies, buyers and their roles | **Merchant Center → Customers → Business units** and **Associate roles**. |
| Homepage banners, info blocks, featured products, static pages (delivery, terms, about), the blog | The **Sanity Studio**, built into the storefront at `/studio`, with image uploads, rich text, live product cards and a preview. Blocks can be limited to stores and categories and scheduled with start and end dates. |
| Quotes | Merchant Center **Quotes**: answer requests, set prices and validity. |
| Orders and approvals | Merchant Center **Orders**. Approval rules can also be managed by company admins in the storefront. |

## Screenshots

| Category page | Product page |
|---|---|
| ![Category page](docs/images/category.jpg) | ![Product page with gallery and quote](docs/images/product.jpg) |

| Quick order | Mobile |
|---|---|
| ![Quick order](docs/images/quick-order.jpg) | ![Mobile homepage](docs/images/home-mobile.jpg) |

## How it works

```
Browser ──> Next.js 16 (App Router, Server Components, Server Actions)
              │
              ├─ admin API client (server only) ──> catalog, prices, business units, content
              └─ customer token (per sign-in, narrowed scopes) ──> my carts, orders, quotes, lists
                                     │
                                     v
                     commercetools Composable Commerce
                     (stores, channels, standalone prices, business units,
                      associate roles, quotes, approval flows, shopping lists)
```

Key design choices:

- **Cached, then personal.** Every page is a prerendered shell served from the CDN (Next.js Cache Components), built from shared cached data that never includes anything about the visitor; their prices, cart and account stream in behind it. Account, cart, checkout and sign-in pages render per request instead, so they can carry a strict Content-Security-Policy nonce. Redirects and 404s are decided before streaming, so they keep real status codes.
- **Server-first.** Pages are React Server Components. Every change (add to cart, place order, approve) is a Server Action. No commercetools credentials ever reach the browser.
- **Least privilege.** Each signed-in customer gets their own commercetools token, limited to "my" resources in the stores they buy from. The admin client is only used after a live permission check.
- **Standalone prices.** Prices are selected per store, channel, currency and country, so each company sees its own prices.
- **Clean URLs.** Categories by their tree path (`/excavators/wheeled-excavators`), products and content pages at the root (`/jj234-wx`), filters in the query string. Old addresses and other spellings redirect permanently, merchants add their own redirects (`npm run ct:urls`), and clashes are reported instead of silently shadowing a page.
- **SEO built in.** Metadata and canonical URLs per page, Product and Breadcrumb structured data (JSON-LD), sitemap, robots.txt, and `next/image`. Company prices never appear in markup.
- **No lock-in.** Plain Next.js, the official commercetools TypeScript SDK and Tailwind CSS. No paid frontend platform.

## Quick start

**You need:** Node.js 22 and a commercetools project (a free trial works). Load the **B2B sample data** for the demo.

1. **Clone and install**

   ```bash
   git clone https://github.com/sohelrana09/forgeline-storefront.git
   cd forgeline-storefront
   npm install
   ```

2. **Set it up**

   In Merchant Center → Settings → Developer settings, create an API client from the template **"Admin client"** and keep its page open (the secret is shown once). Then:

   ```bash
   npm run setup
   ```

   It asks for the project key, the client's ID and secret and your region, and does the rest:

   - writes `.env` (and generates `REVALIDATE_SECRET`);
   - checks the admin client and that the B2B sample data is loaded;
   - creates the **storefront** API client for customer sign-in with exactly the scopes the shop needs (if your admin client may create API clients; otherwise it lists the scopes and asks for that client's ID and secret), and checks it;
   - generates a demo password in `.env.demo` and, once you confirm, sets it on the sample users (only on a demo project: it replaces their passwords);
   - seeds what the B2B features need (purchase-list permissions, a demo approval rule) and, with Sanity configured, a demo blog.

   It's safe to run again: it never replaces a value you set and skips what's already done. `npm run setup -- --check` only reports what's ready and what's missing. Add `--with-pricing-demo` for the quantity-break and customer-group price demos.

   <details>
   <summary>Doing it by hand instead</summary>

   - Create two API clients: an **admin** client (template "Admin client", server only) and a **storefront** client with these scopes *for every store you sell from*: `manage_my_profile`, `manage_my_orders`, `manage_my_quote_requests`, `manage_my_quotes`, `manage_my_shopping_lists`, `create_anonymous_token`.
   - `cp .env.example .env` and fill in both clients, your project key and your region URLs (see [Configuration](#configuration)); check with `npm run ct:hello`.
   - For the sample buyers, put `DEMO_BUYER_PASSWORD=<a password of your choice>` in a git-ignored `.env.demo`, then run `npm run ct:seed-associates -- --force`, `npm run ct:seed-list-permissions -- --yes` and `npm run ct:seed-approval-rules`.

   </details>

3. **Run**

   ```bash
   npm run dev
   ```

   Open http://localhost:3000. Browse as a guest, or sign in with the password in `.env.demo` as `sofia-lopez@ltsl.com` (buyer), `carlos-garcia@ltsl.com` (approver) or `oliver-smith@ltsl.com` (company admin).

4. **Deploy**

   [![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fsohelrana09%2Fforgeline-storefront&project-name=forgeline-storefront&repository-name=forgeline-storefront&env=CTP_PROJECT_KEY,CTP_CLIENT_ID,CTP_CLIENT_SECRET,CTP_AUTH_URL,CTP_API_URL,CTP_SCOPES,CTP_STOREFRONT_CLIENT_ID,CTP_STOREFRONT_CLIENT_SECRET,SITE_URL,REVALIDATE_SECRET&envDescription=The%20commercetools%20clients%2C%20the%20public%20address%20and%20the%20cache%20refresh%20secret%2C%20as%20written%20by%20npm%20run%20setup&envLink=https%3A%2F%2Fgithub.com%2Fsohelrana09%2Fforgeline-storefront%2Fblob%2Fmain%2F.env.example)

   The button copies the repository to your GitHub account and creates a Vercel project. It asks for the settings the shop needs: copy them from the `.env` that `npm run setup` wrote, and set `SITE_URL` to the project's public address (for example `https://your-shop.vercel.app`). `vercel.json` runs the functions in `cle1`, next to commercetools' AWS us-east-2; change it if your project is in another region (see [Configuration](#configuration)). Any other Next.js host works too.

## Configuration

All settings live in `.env` (never commit it). `.env.example` documents every variable.

| Variable | Purpose |
|---|---|
| `CTP_PROJECT_KEY`, `CTP_CLIENT_ID`, `CTP_CLIENT_SECRET`, `CTP_SCOPES` | Admin API client (server only). |
| `CTP_AUTH_URL`, `CTP_API_URL` | Your region, for example `https://auth.us-east-2.aws.commercetools.com`. |
| `CTP_STOREFRONT_CLIENT_ID`, `CTP_STOREFRONT_CLIENT_SECRET` | Client for customer sign-in (password flow). |
| `SITE_URL` | Public address of the shop. Needed for production builds, email links, canonicals and the sitemap. |
| `SITE_INDEXABLE` | `true` lets search engines index the catalog. Anything else (the default) keeps the whole site out of Google and Bing: `noindex` on every response and an empty sitemap. |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | Optional. Shares the rate limits (sign-in, sign-up, checkout) across all server instances. On Vercel, connect Upstash under Storage and they are set for you. |
| `REVALIDATE_SECRET` | Password for `POST /api/revalidate`, which refreshes the cached data behind every page after a change (Sanity webhook, `npm run ct:revalidate`, an optional catalog Subscription). Use the same value in `.env` and your hosting. |
| `B2C_CARD_PAYMENTS`, `CTP_CHECKOUT_APPLICATION_KEY` | Card payments through commercetools Checkout (a Payment Only application in Merchant Center). Off by default: consumers pay by bank transfer. |
| `NEXT_SANITY_PROJECT_ID`, `NEXT_SANITY_DATASET`, `SANITY_API_READ_TOKEN`, `SANITY_API_WRITE_TOKEN` | Optional. Sanity for content pages, blocks and the blog (Studio at `/studio`); the read token powers draft preview, the write token only the demo blog script. Without a project id there are no content pages and the blog is off. |
| `RESEND_API_KEY`, `MAIL_FROM` | Optional. Sends emails (sign-up, password reset, approvals) through Resend; without them, development prints emails to the server log. |
| `CATALOG_SEARCH` | Optional. `product-search` uses the commercetools Product Search API once it is activated; otherwise search uses a built-in index. |

**Hosting region:** keep the storefront next to your commercetools region, because every page talks to the API. `vercel.json` pins Vercel functions to `cle1` (Cleveland), beside commercetools' AWS us-east-2. If your project is in another region, change it, for example to `fra1` for europe-west1. From far away, each API call adds a few hundred milliseconds.

Store prices: the sample stores have no countries set, so the mapping from store to currency and country is in `STORE_PRICING` in `src/features/business-units/service.ts`. Adjust it for your own stores.

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Development server on port 3000. |
| `npm run build` / `npm start` | Production build (also type-checks) and server. |
| `npm run typecheck` / `npm run lint` | Quality gates. |
| `npm run format` / `npm run format:check` | Prettier (2 spaces, width 140; `.editorconfig` for editors). |
| `npm test` | Unit tests (Vitest). |
| `npm run setup` | One-command setup: `.env`, both API clients, demo sign-ins and demo data (`-- --check` reports only). |
| `npm run test:e2e` | Browser tests (Playwright): guest flows (read-only), plus signed-in buyer, approver and admin flows when `.env.demo` has the demo password. Run `npx playwright install chromium` once. |
| `npm run ct:hello` | Smoke test: credentials, project, first products and business units. |
| `npm run ct:contexts` | Prints each business unit's store, channel and currency. |
| `npm run -s ct:query -- <path> [where] [limit]` | Read-only API query, handy with `jq`. |
| `npm run ct:sanity-content` | Demo blog in Sanity (pages and blocks are edited at `/studio`). |
| `npm run ct:sanity-webhook` | Link to create the Sanity webhook that refreshes cached pages on publish. |
| `npm run ct:seed-buyers` / `ct:seed-associates` | Demo passwords for the sample buyers, admins and approvers. |
| `npm run ct:seed-approval-rules` | Demo approval rule: orders over €10,000 need approval. |
| `npm run ct:quote-respond -- <requestId> --discount 10` | Acts as the seller and publishes a quote, for testing. |
| `npm run ct:create-bu -- <key> <email>` | Creates a company business unit with a buyer. |
| `npm run ct:urls` | Lists catalog URLs and clashes; adds or removes merchants' redirects (`-- --add /old /new`). |
| `npm run ct:seed-list-permissions` | Gives the buyer and admin roles the permissions for company-shared purchase lists. |
| `npm run ct:tier-prices` / `ct:customer-group-prices` | Pricing demos: quantity breaks, and B2C prices for a customer group. |
| `npm run ct:price -- <price key> [<cents> --yes]` | Shows or sets one standalone price (dry run without `--yes`). |
| `npm run ct:revalidate` | Refreshes the cached data now (`-- --scope catalog` after a price or product import). |
| `npm run ct:catalog-subscription` | Optional: a commercetools Subscription so catalog changes refresh the cache automatically. Needs a queue service (AWS EventBridge or Google Pub/Sub). |

All scripts are idempotent, so running them twice changes nothing the second time.

## Project structure

```
src/app/           routes only (thin pages): (shop) cached catalog, content, blog, search, quick order;
                   (private) per-request account, cart, checkout and sign-in; studio
src/features/<x>/  one folder per business area: catalog, cart, checkout, orders, quotes,
                   approvals, purchase-lists, company, account, auth, cms, quick-order, ...
    components/    the feature's UI
    actions.ts     Server Actions (public entry points)
    service.ts     commercetools calls and business logic
src/components/    shared UI: header, footer, buttons, list toolbars
src/lib/           infrastructure: commercetools clients, caching, rate limits, mailer
src/studio/        the Sanity Studio (pages, blocks, blog), embedded at /studio
scripts/           setup, seed and maintenance scripts
docs/images/       screenshots
```

## Roadmap

Done: company switcher, customer sign-in, quick order with CSV upload, storefront pages, content management, quotes, guest cart, My account, company area, B2C accounts, SEO, image gallery, one-page checkout, search autocomplete, homepage banners, purchase lists (personal and company-shared), approval rules, clean URLs, order documents (PDF, CSV), cached pages for every visitor, signed-in browser tests, one-command setup.

Next:
- Card payments by default (a direct payment provider such as Stripe, or commercetools Checkout).
- More B2B features, for example recurring orders, spending limits per buyer and shared carts.

Ideas and pull requests are welcome, see [Contributing](#contributing).

## FAQ

**Is this an official commercetools product?**
No. Forgeline is an independent open-source project. commercetools is a trademark of commercetools GmbH.

**Do I need commercetools Frontend (the paid frontend platform)?**
No. Forgeline is plain Next.js and can be hosted anywhere Next.js runs, for example Vercel, Netlify, AWS or your own Node server.

**Can I use my own catalog instead of the sample data?**
Yes. The storefront reads whatever is in your project. Check `STORE_PRICING` for your stores, and the category menu follows your Merchant Center category tree.

**Is it production-ready?**
It is a reference build with security in mind (narrowed customer tokens, server-only credentials, rate limits, encrypted session cookies). Review it against your own requirements, configure email (Resend) and a card payment provider, and run your own tests before going live.

## Contributing

Bug fixes, new B2B or B2C workflows and better documentation are all welcome. For larger changes, open an issue first so we can agree on the approach.

1. Fork the repository and create a branch: `git checkout -b feature/your-change`.
2. Make your change, following the [project structure](#project-structure): pages stay thin, Server Actions go in `actions.ts` (every export is a public endpoint), commercetools calls in `service.ts`, and pure logic in small modules with unit tests next to them.
3. Run the checks: `npm run typecheck`, `npm run lint`, `npm test` and `npm run format:check`, plus `npm run test:e2e` for anything a visitor sees.
4. Commit, push the branch and open a pull request that says what changed and how you tested it.

Browser tests that sign in or change data must put back what they create, because they run against a shared commercetools project.

## License

[MIT](LICENSE). You may use, change and redistribute Forgeline, also in commercial projects, as long as the copyright notice stays.

---

Made with Next.js and commercetools. If Forgeline helps you, please give it a star.

