# Getting Started

This page takes you from an empty machine to Forgeline running on http://localhost:3000.

## 1. Prerequisites

- **Node.js 24** and **npm 11**. With nvm or fnm, run `nvm use` in the project folder; `.nvmrc` picks the right version.
- **A commercetools project.** Load the **B2B sample data** in Merchant Center when you create it: 72 industrial products, 6 business units and 5 stores. The demo accounts and prices assume it. You can use your own catalog too; see [Commercetools Configuration](Commercetools-Configuration).
- **An admin API client.** In Merchant Center → Settings → Developer settings → Create new API client, pick the template **"Admin client"**. Keep the page open: the secret is shown only once.

## 2. Clone and install

```bash
git clone https://github.com/sohelrana09/forgeline-storefront.git
cd forgeline-storefront
npm install
```

## 3. Run the setup

```bash
npm run setup
```

It asks for the project key, the admin client's ID and secret, and your region, then:

1. writes `.env` (never commit it) and generates `SESSION_SECRET` and `REVALIDATE_SECRET`;
2. checks the admin client and that the B2B sample data is loaded;
3. creates the **storefront** API client for customer sign-in with exactly the scopes it needs (or lists the scopes and asks for that client's ID and secret if your admin client can't create API clients);
4. writes a generated demo password to the git-ignored `.env.demo` and, once you confirm, sets it on the sample users (only on a demo project: it replaces their passwords);
5. seeds what the B2B features need: purchase-list permissions and a demo approval rule.

It is safe to run again: it never replaces a value you set and skips what is already done.

| Variant | What it does |
|---|---|
| `npm run setup -- --check` | Read-only report of what is ready and what is missing |
| `npm run setup -- --yes --demo-passwords` | No questions (for CI) |
| `npm run setup -- --with-pricing-demo` | Adds the quantity-break and customer-group price demos |

Check the connection at any time:

```bash
npm run ct:hello
```

## 4. Start the shop

```bash
npm run dev
```

Open http://localhost:3000. Browse as a guest, or sign in with the password from `.env.demo` as one of the sample users:

| Role | Email |
|---|---|
| Buyer | `sofia-lopez@ltsl.com` |
| Approver | `carlos-garcia@ltsl.com` |
| Company admin | `oliver-smith@ltsl.com` |

## 5. Check your work

| Command | What it checks |
|---|---|
| `npm run typecheck` | TypeScript (src and scripts) |
| `npm run lint` | ESLint |
| `npm test` | Unit tests (pure logic, no network) |
| `npm run format:check` | Prettier |
| `npm run test:e2e` | Playwright browser tests against the dev server (signed-in tests run when `.env.demo` exists) |
| `npm run build` | Production build; needs `SITE_URL` |

## Useful commands

| Command | Purpose |
|---|---|
| `npm run -s ct:query -- <path> [where] [limit]` | Read-only GET against your project, for example `npm run -s ct:query -- stores` |
| `npm run ct:contexts` | Business unit → store → channel mapping the shop uses |
| `npm run ct:urls` | URL table, clashes and merchants' redirects |
| `npm run ct:revalidate -- --url http://localhost:3000 --scope all` | Refresh the cached data after a change |

Scripts that change data are dry runs until you add `--yes`.

## Project layout

```
src/app/          routes only; pages are thin
src/features/<x>/ one module per business area: components/, actions.ts (Server Actions), service.ts (commercetools calls), types.ts
src/components/   shared UI
src/lib/          infrastructure: commercetools clients, cache, CSP, rate limits
scripts/          the npm run ct:* and setup scripts
e2e/              Playwright tests
```

Next: [Commercetools Configuration](Commercetools-Configuration), then [Vercel Configuration](Vercel-Configuration).
