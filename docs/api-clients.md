# API clients

Forgeline talks to commercetools with three API clients. Each holds only what its job needs, so a leaked secret or a server bug can do as little as possible.

| Client | Variables | Used by | Lives in |
|---|---|---|---|
| **Runtime** | `CTP_CLIENT_ID`, `CTP_CLIENT_SECRET` | The running shop (server side): catalog, company area, orders, quotes, approvals | `.env` and your hosting |
| **Storefront** | `CTP_STOREFRONT_CLIENT_ID`, `CTP_STOREFRONT_CLIENT_SECRET` | Customer sign-in and guest carts; customers get narrowed tokens | `.env` and your hosting |
| **Admin** | `CTP_ADMIN_CLIENT_ID`, `CTP_ADMIN_CLIENT_SECRET` (optional `CTP_ADMIN_SCOPES`) | `npm run setup` and the `ct:*` scripts: seeding, prices, redirects, roles | `.env` on your machine only, **never** in the hosting |

To get started, one admin client in `CTP_CLIENT_*` runs everything (that's what `npm run setup` sets up). Before going live, give the shop its own runtime client.

## Why

The "Admin client" template holds `manage_project`: products, prices, discounts, every customer and order, project settings. If the shop runs with it, anyone who gets its secret (a leaked environment variable, a compromised dependency, a server-side bug) controls the whole project. The runtime client can't change products, prices, discounts, API clients or settings.

## The runtime client's scopes

The list is in [`src/lib/commercetools/scopes.ts`](../src/lib/commercetools/scopes.ts) (`RUNTIME_SCOPES`):

| Scope | Why the shop needs it |
|---|---|
| `view_published_products`, `view_standalone_prices` | Catalog pages, search and cart prices (price selection on standalone prices) |
| `view_categories`, `view_stores`, `view_shipping_methods` | Menu and category pages, each unit's store and channel, delivery methods |
| `view_associate_roles`, `manage_business_units` | Company area: roles, users, invitations, profile |
| `manage_customers` | Email confirmation, password reset, colleagues' names in the company area |
| `manage_orders` | Company orders, approvals, ordering from a quote, checkout |
| `manage_quotes` | Renegotiating a quote |
| `manage_approval_flows`, `manage_approval_rules` | Approvals and the company's approval rules |
| `manage_shopping_lists` | Company-shared purchase lists |
| `manage_key_value_documents` | Invitations, sign-out after a password reset, merchants' redirects (Custom Objects) |
| `manage_sessions` | Card payments through commercetools Checkout |

Every write with these scopes happens only after the signed-in associate's permission is checked live in the selected business unit.

## Switching over

1. **Merchant Center** → Settings → Developer settings → **Create new API client**, no template. Name it, for example, "Forgeline runtime", tick exactly the scopes above (project-wide), and create it. Copy the ID and secret (the secret is shown once).
2. **On your machine**, in `.env`:
   - move the current `CTP_CLIENT_ID` and `CTP_CLIENT_SECRET` to `CTP_ADMIN_CLIENT_ID` and `CTP_ADMIN_CLIENT_SECRET` (the scripts keep working with them);
   - put the new runtime client in `CTP_CLIENT_ID` and `CTP_CLIENT_SECRET`;
   - empty `CTP_SCOPES` (the runtime client gets all of its own scopes).
3. **Check it:** `npm run setup -- --check` should say "narrowed client" under "Runtime API client". Then run the shop and the signed-in browser tests against it before deploying:

   ```bash
   npm run build && npm start
   ```

   ```bash
   npm run test:e2e
   ```

   A missing scope shows up as a 403 `insufficient_scope` in the server log, naming the scope.
4. **Hosting (Vercel):** set `CTP_CLIENT_ID` and `CTP_CLIENT_SECRET` to the runtime client, remove `CTP_SCOPES`, and redeploy. Don't add the admin client there.
5. Once production runs on the runtime client, the old admin client is only used from your machine. Rotate its secret if it was ever in the hosting.

The session cookies don't depend on these clients once `SESSION_SECRET` is set, so switching or rotating clients doesn't sign anyone out.

## Going back

Put the admin client back in `CTP_CLIENT_*` (with `CTP_SCOPES=manage_project:<project key>`) and redeploy. Nothing is stored that depends on which client the shop uses.
