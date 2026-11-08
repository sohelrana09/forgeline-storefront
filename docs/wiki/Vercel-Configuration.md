# Vercel Configuration

Forgeline deploys to Vercel as a standard Next.js project. Any other Next.js host works too, but crons and the region setting below are Vercel-specific.

## 1. Create the project

**Option A: Deploy button.** The README's "Deploy with Vercel" button copies the repository to your GitHub account, creates the Vercel project and asks for the required variables.

**Option B: Import.** Fork or push the repository to your GitHub account, then in Vercel: Add New → Project → Import the repository. Framework preset **Next.js**; leave the build command (`npm run build`), output and install settings at their defaults.

Once connected, every push to `main` deploys to production and every other branch or pull request gets a preview deployment.

## 2. Region

Every page talks to commercetools, so the functions must run next to your commercetools region. `vercel.json` pins them:

```json
{ "regions": ["cle1"] }
```

`cle1` (Cleveland) sits beside commercetools' AWS **us-east-2**. If your project is elsewhere, change it to the nearest Vercel region, for example `fra1` for europe-west1 or eu-central-1. From far away, each API call adds a few hundred milliseconds.

## 3. Environment variables

Project → Settings → Environment Variables. Copy the values from the `.env` that `npm run setup` wrote. Set them for **Production**, and for **Preview** if you use preview deployments. A change takes effect only after a **redeploy**.

### Required

| Variable | Value |
|---|---|
| `CTP_PROJECT_KEY` | Your project key |
| `CTP_AUTH_URL`, `CTP_API_URL` | Your region's URLs |
| `CTP_CLIENT_ID`, `CTP_CLIENT_SECRET` | The runtime client (see [Commercetools Configuration](Commercetools-Configuration)) |
| `CTP_SCOPES` | `manage_project:<project key>` while you run on the admin client; remove it once you use a runtime client |
| `CTP_STOREFRONT_CLIENT_ID`, `CTP_STOREFRONT_CLIENT_SECRET` | The storefront client |
| `SESSION_SECRET` | At least 32 random characters (`openssl rand -hex 32`). Production refuses to start without it |
| `SITE_URL` | The public address, for example `https://your-shop.vercel.app`. The build fails without it |
| `REVALIDATE_SECRET` | Protects `POST /api/revalidate`; same value as in your local `.env` |
| `CRON_SECRET` | At least 32 random characters. Vercel Cron sends it to the cron routes as a Bearer token |

Never add `CTP_ADMIN_CLIENT_*` to Vercel.

### Recommended for production

| Variable | Purpose |
|---|---|
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | Shares rate limits across instances. In Vercel, Storage → connect Upstash Redis and they are set for you |
| `RESEND_API_KEY`, `MAIL_FROM` | Sends sign-up, password reset and approval emails. Without them no email goes out |
| `SITE_INDEXABLE=true` | Lets search engines index the catalog. Leave it out on test and preview sites: everything then sends `noindex` |

### Optional

| Variable | Purpose |
|---|---|
| `NEXT_SANITY_PROJECT_ID`, `NEXT_SANITY_DATASET`, `SANITY_API_READ_TOKEN` | Content pages, banners and the blog from Sanity (Studio at `/studio`) |
| `SANITY_WEBHOOK_SECRET`, `SANITY_WEBHOOK_CONFIGURED`, `STUDIO_URL` | Sanity publish webhook and a Studio on its own domain |
| `CTP_CHECKOUT_APPLICATION_KEY`, `B2C_CARD_PAYMENTS`, `CHECKOUT_PAYPAL`, `B2C_BANK_TRANSFER`, `CHECKOUT_BRAINTREE` | Consumer and guest payments |
| `ORDER_EVENTS_SECRET` | Order Subscription calls to `/api/order-events` |
| `IMAGES_UNOPTIMIZED=true` | Bypasses `/_next/image` when the image optimizer quota runs out |
| `NEXT_PUBLIC_SITE_LOCALE`, `NEXT_PUBLIC_GTM_ID` | Shop language, Google Tag Manager |
| `CSP_REPORT_URI`, `OTEL_EXPORTER_OTLP_ENDPOINT` | CSP reports, tracing |
| Feature flags | See [Feature Flags](Feature-Flags) |

`.env.example` in the repository documents every variable.

### Build-time variables

These are read during `next build`, so changing them needs a redeploy (with "Use existing build cache" off if in doubt): `SITE_URL`, `SITE_INDEXABLE`, `IMAGES_UNOPTIMIZED`, `NEXT_PUBLIC_*`, `SANITY_WEBHOOK_CONFIGURED`.

## 4. Cron jobs

`vercel.json` schedules four daily jobs (times in UTC). Each route checks `CRON_SECRET` and does nothing when its feature is off.

| Path | Schedule | Does |
|---|---|---|
| `/api/cron/demo-reset` | 02:00 | Resets the demo personas' data (only with `DEMO_MODE`) |
| `/api/cron/order-sweep` | 03:00 | Retries stuck order steps, expires unpaid bank transfers, raises orphan payments |
| `/api/cron/recurring-orders` | 04:00 | Recurring order reminders (only with `RECURRING_ORDERS`) |
| `/api/cron/stock-alerts` | 05:00 | Back-in-stock emails (only with `STOCK_ALERTS`) |

The Hobby plan runs crons at most once a day. On Pro you can run the order sweep every 15 minutes (`*/15 * * * *`). Crons run on production deployments only; see them under Project → Settings → Cron Jobs.

## 5. Domain

Project → Settings → Domains → add your domain and follow the DNS steps. Then:

1. set `SITE_URL` to the new address;
2. redeploy;
3. update anything that calls the shop: the Sanity webhook URL, the EventBridge API destination, PunchOut return hosts.

## 6. After the first deploy

- [ ] Open the site and browse a category as a guest
- [ ] Sign in as a sample buyer and add to cart
- [ ] `npm run ct:revalidate -- --url https://<your shop> --scope all` answers `{"revalidated":true}`
- [ ] Run the guest browser tests against it:

```bash
E2E_BASE_URL=https://<your shop> npm run test:e2e
```

- [ ] Functions → logs show no `insufficient_scope` or `request_error` lines

## Preview vs production

- Previews get their own URL per deployment. If they share the production commercetools project, they write to the same data.
- Keep `SITE_INDEXABLE` off for previews.
- For a separate demo or test site, use a separate Vercel project (or environment) with its own `SITE_URL` and, ideally, its own commercetools project.
