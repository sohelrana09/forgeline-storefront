# Commercetools Configuration

What Forgeline expects from your commercetools project, and how to set it up by hand if you don't use `npm run setup`.

## 1. Project and region

- Note your **project key** and **region**. The URLs follow the region, for example for AWS us-east-2:
  - `CTP_AUTH_URL=https://auth.us-east-2.aws.commercetools.com`
  - `CTP_API_URL=https://api.us-east-2.aws.commercetools.com`
- Load the **B2B sample data** for the demo, or bring your own catalog (see section 4).
- Forgeline uses **standalone prices** (Project settings: price mode Standalone). Products carry no embedded prices; the shop selects a price per store channel, currency and country.

## 2. API clients

Forgeline uses up to three API clients. Each holds only what its job needs.

| Client | Variables | Used by | Where it lives |
|---|---|---|---|
| **Runtime** | `CTP_CLIENT_ID`, `CTP_CLIENT_SECRET`, `CTP_SCOPES` | The running shop, server side | `.env` and Vercel |
| **Storefront** | `CTP_STOREFRONT_CLIENT_ID`, `CTP_STOREFRONT_CLIENT_SECRET` | Customer sign-in and guest carts | `.env` and Vercel |
| **Admin** | `CTP_ADMIN_CLIENT_ID`, `CTP_ADMIN_CLIENT_SECRET` | `npm run setup` and the `ct:*` scripts | `.env` on your machine only, never in Vercel |

To get started, one admin client in `CTP_CLIENT_*` runs everything (with `CTP_SCOPES=manage_project:<project key>`). Before going live, give the shop its own runtime client.

### Storefront client

Create it without a template. In the scope form, use **"Add scopes for store(s)"** and tick these **for every store the shop sells from**:

- `manage_my_profile`
- `manage_my_orders`
- `manage_my_quote_requests`
- `manage_my_quotes`
- `manage_my_shopping_lists`
- `create_anonymous_token`

Never reuse the admin client for this. Forgeline always asks for a narrowed token per customer, so a customer's token only reaches their own stores.

### Runtime client (before going live)

Create it without a template and tick these project-wide (the list lives in `src/lib/commercetools/scopes.ts`, `RUNTIME_SCOPES`):

| Scope | Why |
|---|---|
| `view_published_products`, `view_standalone_prices` | Catalog, search, cart prices |
| `view_categories`, `view_stores`, `view_shipping_methods` | Menu, each unit's store and channel, delivery methods |
| `view_associate_roles`, `manage_business_units` | Company area: roles, users, invitations |
| `manage_customers` | Email confirmation, password reset, colleagues' names |
| `manage_orders` | Company orders, approvals, checkout |
| `manage_quotes` | Quote renegotiation |
| `manage_approval_flows`, `manage_approval_rules` | Approvals and approval rules |
| `manage_shopping_lists` | Company-shared purchase lists |
| `manage_key_value_documents` | Invitations, session revocation, redirects (Custom Objects) |
| `manage_sessions` | Card payments through commercetools Checkout |
| `manage_payments` | Payments for invoice and bank-transfer orders, and reading how an order was paid |
| `manage_products` | Putting stock back after a cancelled order |

Easy to get wrong: tick **View**, not Manage, for standalone prices, categories, stores, shipping methods and associate roles. Tick **Manage** for business units, or signed-in buyers can't load their company.

Optional features need extra scopes (see [Feature Flags](Feature-Flags)):

| Flag | Extra scopes |
|---|---|
| `RECURRING_ORDERS` | `manage_recurring_orders`, `view_recurrence_policies` |
| `REVIEWS` | `manage_reviews`, `view_states` |

commercetools doesn't let you add scopes to an existing client: create a new one and swap the ID and secret.

**Switching over:** move the current `CTP_CLIENT_*` values to `CTP_ADMIN_CLIENT_*` in your local `.env`, put the runtime client in `CTP_CLIENT_*`, empty `CTP_SCOPES`, and run `npm run setup -- --check`. It should say "narrowed client" and list anything missing or more than needed. Then update Vercel.

## 3. Business model the shop expects

```
Business Unit (Company → Division) → Associates with Associate Roles → Store → Distribution Channel → Standalone Prices
```

- **Business units** decide who buys for which company. Divisions with `storeMode: FromParent` inherit the parent's stores.
- **Associate roles** grant permissions. The shop reads permissions, not role names: a buyer needs `CreateMyCarts` and `CreateMyOrdersFromMyCarts`; quotes need `CreateMyQuoteRequestsFromMyCarts`.
- **Stores** each need a **distribution channel**; company prices are standalone prices on that channel.
- **Guests and consumers** buy in `default-store` at its list prices.

Check the mapping the shop sees:

```bash
npm run ct:contexts
```

## 4. Store currency and country (`STORE_PRICING`)

The sample stores have no countries set, so the store → currency and country mapping is in code: `STORE_PRICING` in `src/features/business-units/service.ts`. **Add every store you sell from**; a store missing there gives its units no buying context. With your own catalog, edit this map first.

## 5. One-off data setup per feature

All are dry runs without `--yes` and safe to run twice.

| Command | Needed for |
|---|---|
| `npm run ct:seed-list-permissions -- --yes` | Company-shared purchase lists (adds permissions to the buyer and admin roles) |
| `npm run ct:seed-approval-rules` | A demo approval rule |
| `npm run ct:order-approval-type -- --yes` | The order Type for approval status, procurement fields and shared carts |
| `npm run ct:seed-cart-review-permissions -- --yes` | Shared carts (approver may review and order a colleague's cart) |
| `npm run ct:review-states -- --yes` | Product reviews (needs `manage_states` on the admin client) |
| `npm run ct:punchout -- --unit <key> --customer <email> --identity <id> --return-host <host>` | A PunchOut connection |
| `npm run ct:product-selections -- --key <k> --name "<n>" --skus a,b --store <s> --yes` | Company assortments (needs `manage_product_selections`, `manage_stores`) |
| `npm run ct:tier-prices -- --yes` | Quantity-break price demo |
| `npm run ct:seed-buyers` / `npm run ct:seed-associates -- --force` | Demo password on the sample users |

## 6. Card payments (commercetools Checkout)

Business buyers order on invoice with a PO number; no setup needed. For consumers and guests:

1. Merchant Center: turn on **Checkout**, install a payment **Connector** (for example the Braintree one), create a **Payment Only** Application and add the payment integration.
2. Set `CTP_CHECKOUT_APPLICATION_KEY` and switch methods on: `B2C_CARD_PAYMENTS=true`, `CHECKOUT_PAYPAL=true`, `B2C_BANK_TRANSFER=true` (and `CHECKOUT_BRAINTREE=true` when cards run on Braintree).
3. Optional: `npm run ct:order-subscription -- --eventbridge <aws-account-id> --yes` sends order and payment messages to `/api/order-events` (`ORDER_EVENTS_SECRET`).

With no payment switch on, the payment step says ordering isn't available. Full steps: `docs/checkout-setup.md` in the repository.

## 7. Search

Product Projection Search and the Product Search API are **off** in a new project. Forgeline's search and category filters run in memory, which works up to about 500 products per category. For a bigger catalog, activate the Product Search API in Merchant Center and set `CATALOG_SEARCH=product-search`.

## 8. Cache refresh after catalog changes (optional)

Without anything extra, price and product changes show within 15 minutes. To refresh at once:

```bash
npm run ct:revalidate -- --url https://your-shop.vercel.app --scope catalog
```

For automatic refreshes, a commercetools Subscription sends changes through AWS EventBridge to `POST /api/revalidate`:

```bash
npm run ct:catalog-subscription -- --eventbridge <aws-account-id> --yes
```

Then, in the AWS console in your project's region: associate the partner event source with an event bus, create an API destination `POST https://<your shop>/api/revalidate` with header `Authorization: Bearer <REVALIDATE_SECRET>`, and a rule that sends the commercetools events to it. Full steps: `docs/cache-refresh.md` in the repository.

## Checklist

- [ ] Project key, region URLs and price mode Standalone
- [ ] Admin client (local only)
- [ ] Storefront client with per-store scopes for every store
- [ ] Every store in `STORE_PRICING`
- [ ] `npm run setup -- --check` shows no gaps
- [ ] Before going live: a runtime client with only the scopes above
