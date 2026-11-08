# Feature Flags

Optional features are off by default. Set the variable to `true` (locally in `.env`, in Vercel under Environment Variables, then redeploy). Pages of a switched-off feature answer 404.

| Flag | Feature | Also needs |
|---|---|---|
| `PROCUREMENT_FIELDS` | Cost centre, project code, delivery date and order note at business checkout | `npm run ct:order-approval-type -- --yes` |
| `SPENDING_LIMITS` | Company and buyer budgets at `/account/company/budgets` | |
| `RECURRING_ORDERS` | Repeat an order or purchase list on commercetools Recurring Orders | Scopes `manage_recurring_orders`, `view_recurrence_policies`; `CRON_SECRET` |
| `SHARED_CARTS` | Send a cart to a colleague for review | `ct:order-approval-type`, `ct:seed-cart-review-permissions` |
| `PUNCHOUT` | cXML and OCI PunchOut for procurement systems | A connection from `npm run ct:punchout` |
| `REVIEWS` | Reviews from verified buyers | `ct:review-states`; scopes `manage_reviews`, `view_states` |
| `STOCK_ALERTS` | "Email me when it's back" | Email (Resend), `CRON_SECRET` |
| `CHECKOUT_EXPRESS` | Wallet buttons on the cart | A Checkout payment switch and an express integration |
| `CATALOG_SEARCH=product-search` | Search and category listings on the Product Search API | Product Search activated in Merchant Center |
| `AI_PO_TO_CART` | Read a purchase order (PDF or text) into quick order with Claude | `ANTHROPIC_API_KEY` (server only) |
| `DEMO_MODE` | One-click demo personas, demo banner, nightly reset | `DEMO_PASSWORD`; only on a demo project |

Payment methods (`B2C_CARD_PAYMENTS`, `CHECKOUT_PAYPAL`, `B2C_BANK_TRANSFER`) are covered in [Commercetools Configuration](Commercetools-Configuration).

Each feature has a detailed page under `docs/features/` in the repository.
