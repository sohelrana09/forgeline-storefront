# Forgeline wiki

Forgeline is an open-source B2B and B2C storefront for **commercetools Composable Commerce**, built with **Next.js 16** (App Router, Server Components, Cache Components) and the official commercetools TypeScript SDK. One storefront serves business buyers, consumers and guests, each with their own prices, cart and checkout.

- Live demo: https://forgeline-storefront-gamma.vercel.app/
- Source: https://github.com/sohelrana09/forgeline-storefront

## Where to start

| You want to | Read |
|---|---|
| Run Forgeline on your machine | [Getting Started](Getting-Started) |
| Prepare your commercetools project (API clients, scopes, stores, prices) | [Commercetools Configuration](Commercetools-Configuration) |
| Deploy to Vercel (environment variables, region, crons, domains) | [Vercel Configuration](Vercel-Configuration) |
| Switch optional features on | [Feature Flags](Feature-Flags) |
| Fix a common problem | [Troubleshooting](Troubleshooting) |

## How it fits together

```
Browser ──> Next.js 16 on Vercel (Server Components, Server Actions)
              │
              ├─ runtime API client (server only) ──> catalog, prices, business units, orders
              └─ customer token (per sign-in, narrowed scopes) ──> my carts, orders, quotes, lists
                                     │
                                     v
                     commercetools Composable Commerce
```

- No commercetools credentials ever reach the browser.
- Each signed-in customer gets their own token, limited to their own resources in the stores they buy from.
- Catalog pages are cached shells served from the CDN; each visitor's prices and cart stream in behind them.
- Optional extras: Sanity for content pages and a blog, Upstash Redis for shared rate limits, Resend for email, commercetools Checkout for card payments.

## What you need

- Node.js 24 with npm 11 (the repository's `.nvmrc` pins it)
- A commercetools project (a free trial works), ideally with the **B2B sample data** loaded
- A GitHub account and a Vercel account for deployment
