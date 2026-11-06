# commercetools Checkout setup (card payments)

Consumers and guests pay by card through **commercetools Checkout** in **Payment Only** mode. Our checkout page collects the address and delivery method. Checkout then shows the payment methods, takes the payment through a Connector and creates the Order. Business buyers keep ordering on invoice with a PO number.

The code is ready. These one-time steps happen in Merchant Center, in your project. Below, `<project-key>` is your project key and `<region>` its region as in `CTP_API_URL` (for example `us-east-2.aws`).

## 1. Turn on Checkout

Merchant Center → **Checkout** → **Get started** → **Let's proceed** → **Confirm creation**. This confirms Checkout's predefined permissions and Subscription.

## 2. Install a payment Connector

The connector needs its **own** API client (Settings → Developer settings → Create new API client) with exactly these scopes, ticked by hand: Manage *Orders*, *Payments*, *Types*; View *Checkout sessions*, *Types*; Tokens *Introspect OAuth Tokens*, *View API clients*. The "all access" / admin template does **not** include the two Tokens scopes, and without them Checkout silently drops the connector. Enter the client's ID and secret when installing the connector.


Merchant Center → **Connect** → marketplace. Search for the **sample payment Connector** (credit card, invoice, purchase order) and install it. It simulates payments, so no payment provider account is needed and no money moves.

For real payments later, install the **Adyen** or **PayPal** Connector (or a third-party one, such as Stripe) instead, with that provider's test account.

## 3. Create the Payment Only Application

Merchant Center → **Checkout** → **Add application** → **Add payment only**:

| Field | Value |
|---|---|
| Application name | Ironline storefront |
| Application key | `ironline-payment` (the code's default; to use another key, set `CTP_CHECKOUT_APPLICATION_KEY` in `.env`) |
| Countries | Germany, France, Spain, United Kingdom (the consumer delivery countries) |
| Origin URLs | For local testing, turn on **allow all URLs** (`http://localhost:3000` may not pass the URL pattern). In production, list the real storefront URL. |

**Save**.

## 4. Add the payment integration

In the Application → **Payment integrations** → **Standard Payments** → **Add payment integration**:

- **Connector:** the sample payment Connector
- **Payment method:** credit card
- **Payment integration name:** Card

**Save**, then switch the integration's **Status** on. Finally switch the **Application's Status** on.

## 5. Test

Sign in as the test consumer from `.env.demo` (or check out as a guest). Add a spare part, go to checkout, choose the address and delivery method, then click **Pay by card**.

Test cards from the sample Connector:

| Card | Number |
|---|---|
| Visa | 4111 1111 1111 1111 |
| Mastercard | 5555 5555 5555 4444 |
| American Express | 3419 2595 0237 632 |

For all three, use any future expiry date, any 3 or 4 digit CVC, and any name.

## How it fits together

- `src/lib/commercetools/checkout-session.ts` creates the Checkout Session on `https://session.<region>.commercetools.com/<project-key>/sessions`. It uses an admin-client token narrowed to `manage_sessions` and `manage_orders` for the B2C store.
- `startCardPayment` (`features/checkout/actions.ts`) first reads the cart with the buyer's own token. The cart must be theirs, be the version they reviewed, have a delivery address, method and email, and contain no quote-only machines. Consumers must also have a confirmed email. Only then does it open the session.
- `CardPayment.tsx` runs `paymentFlow()` from `@commercetools/checkout-browser-sdk` inline (`<div data-ctc>`). On `checkout_completed`, `finishCardPayment` reads the new order with the buyer's token, checks that it came from their cart, clears the cart, and opens the order page. Guests go to `/order-confirmation/[id]`.

## The reviewed total is the charged total

When the buyer clicks **Pay by card**, the storefront freezes the cart with the version they reviewed (`freezeCart`, HardFreeze: prices, discounts and the shipping method stay as they are) and only then opens the Checkout session. While the freeze is fresh, the storefront refuses changes to that cart (from any tab) with a message pointing to checkout, where **Cancel payment and change my cart** unfreezes it. A freeze nobody touched for 30 minutes (an abandoned payment) is lifted by the next change. Code: `src/features/cart/freeze.ts` (pure, tested) and `updateMyCart` in `src/features/cart/service.ts`.

Not yet confirmed on a live payment: that Checkout pays and orders a Frozen cart (the Carts docs say frozen carts can be ordered), and that its sessions don't outlive the 30 minutes. If the order total still differs from the reviewed one, the order page says so (`?changed=1`).

## After-order processing (all payment paths)

Every order, however it was created (invoice + PO, bank transfer, card through Checkout, order from a quote), goes through `processOrder` in `src/features/order-processing/service.ts`. It gives the order its number (`ORD-2026-000123`, prefix from `ORDER_NUMBER_PREFIX`) and runs the after-order steps once each. Three callers, so it still happens when the buyer closes the tab right after paying:

1. **The order action**, right after the order exists. It numbers the order before the buyer sees it and runs the rest after the response. This alone covers invoice, bank transfer and quote orders, and card orders whose browser comes back.
2. **A commercetools Subscription** (`storefront-order-events`: `OrderCreated`, `OrderPaymentStateChanged`, `PaymentTransactionAdded`, `PaymentTransactionStateChanged`). Subscriptions deliver to a queue, not a URL:
   1. Merchant Center → Settings → Project settings → **Messages**: switch them on (they are off in the demo project; without them the Subscription delivers nothing).
   2. Set `ORDER_EVENTS_SECRET` (at least 32 random characters) in the deployment.
   3. Queue side as for the cache refresh (`docs/cache-refresh.md`, step 3), with an EventBridge API destination `POST https://<public storefront>/api/order-events` and the header `Authorization: Bearer <ORDER_EVENTS_SECRET>`.
   4. `npm run ct:order-subscription -- --eventbridge <aws-account-id>` shows what it will do; add `--yes` to create it.
   The endpoint answers 500 when a step failed, so the queue retries.
3. **A sweep** for anything both missed: `GET /api/cron/order-sweep` with `Authorization: Bearer <CRON_SECRET>` processes orders from the last 24 hours that have no number or unfinished steps, paging through the window (up to 2,000 orders per run; the response says `more` when the window is bigger). On Vercel, add to `vercel.json`: `"crons": [{ "path": "/api/cron/order-sweep", "schedule": "*/15 * * * *" }]` (Hobby plans allow only daily schedules).

The steps after numbering:

- **Payment** (all orders not paid by card): a Payment with key `order-<order id>`, `paymentMethodInfo.method` `invoice` (business orders, including orders from quotes) or `bank-transfer` (consumers and guests), planned amount = the order's gross total, linked to the order, whose payment state becomes **Pending**. Finance (or the ERP) marks it Paid. Card orders keep the Payment Checkout created. The runtime API client needs **`manage_payments`**. Scopes can't be changed on an existing API client, so create a new one with the runtime scopes (`RUNTIME_SCOPES` in `src/lib/commercetools/scopes.ts`) and put it in `CTP_CLIENT_*`; `npm run setup -- --check` reports a missing scope. When an approver rejects an order, the storefront cancels it and, in the same update, sets a Pending payment state to **Failed** (commercetools has no cancelled payment state); our Payment then gets status code `cancelled` ("Order cancelled before payment"). A cancelled order never gets a Payment; card Payments are left to Checkout. Without it the step fails and is retried; the order itself is unaffected.

- **Confirmation email** (all orders): plain text built from the same data as the confirmation PDF, sent through `src/lib/mailer.ts` (Resend in production; printed to the dev server log otherwise) to the order's email. A failed send is retried. When you first deploy this with the sweep switched on, orders from the last 24 hours that predate it get their number, Payment and confirmation too.

How "once" is guaranteed: the order number is set with the order's version (a second worker gets a 409 and sees the number), and whoever sets it creates the marker Custom Object `order-processing/<order id>`. Each later step is claimed by writing that marker with its version; a claim older than 10 minutes counts as abandoned and may be taken over. Numbers come from the Custom Object `order-number/<prefix>-<year>`; they are unique and increasing, but a number taken by a worker that loses the race is skipped, so the sequence can have gaps.

## Browser tests that place orders

`E2E_ORDERS=1 npm run test:e2e -- --project=orders` runs `e2e/orders`: guest and consumer bank transfer, business invoice with a PO, an order above the approval rule (rejected by the approver) and the card path with Checkout stubbed out, which checks that an open payment locks the cart and that cancelling unlocks it. They are off by default because they place real orders. Each order is cancelled afterwards and its reserved stock added back with a client that has `manage_orders` and `manage_products` (`E2E_CLEANUP_CLIENT_ID` / `E2E_CLEANUP_CLIENT_SECRET`, else the runtime client); without one the tests skip before ordering. The business tests order from a fresh cart they create for the buyer and point the browser at (the `ct_cart_<unit>` cookie), so the demo buyer's own carts are never touched; an unused test cart is deleted. Order numbers they use are not given back. The consumer test needs `E2E_CONSUMER_EMAIL` and `E2E_CONSUMER_PASSWORD` (a confirmed account with a saved address). A real card payment, the email itself and the Subscription are not covered.

## Troubleshooting

- **"Card payment is unavailable right now"** plus `init_error` and a CORS error in the browser console: Checkout's config API (`https://checkout.<region>.commercetools.com/api/<project-key>/config`) could not find an active Application with the key we send, or this site's origin isn't allowed. The CORS error follows from that 404; it isn't a separate problem.
- To see which Applications exist, query the Applications API (scope `view_checkout_applications`): `GET https://checkout.<region>.commercetools.com/<project-key>/applications`.
- To see installed Connectors, query the Connect API (scope `view_connectors_deployments`): `GET https://connect.<region>.commercetools.com/<project-key>/deployments`.
- Make sure the Merchant Center project switcher shows your project while you set up.
- The marketplace name of the test connector is **"Sample payment connector for checkout"** (key `connect-payment-integration`). After installing it, wait until its deployment shows **Deployed** in Connect (this can take several minutes); only then can a payment integration use it.
- `payment-config` answering `"paymentMethods":[],"connectors":[]` means Checkout has no usable payment integration: none active, or the connector's processor fails its status check. The most common cause is the processor's API client missing one of `manage_payments`, `manage_orders`, `view_sessions`, `view_api_clients`, `introspect_oauth_tokens`, `manage_types`, `view_types` (Checkout then shows "An error occurred. Please try again." in the payment area).
- **`/api/{project}/config` answers 401 "Session not found"** although the Sessions API can read the session: Checkout itself can't read sessions. This happens when Checkout's own permissions or API client were removed (for example while rotating API keys). Redo step 1 (Checkout → Get started → confirm permissions and Subscription).
- Rotating `CTP_CLIENT_SECRET` signs everyone out and empties guest carts in the browser: the session and guest cookies are encrypted with a key derived from it.
- **Config 200 but `payment-config` returns `"connectors":[]`** with a Deployed connector: Checkout drops connectors whose processor fails its status check. Open Manage organizations & teams → Connect → Manage connectors → the deployment → logs, and check the processor's API client has all seven scopes (`view_api_clients` and `introspect_oauth_tokens` are the ones most often missed).
- **Redeploying or reinstalling the connector creates a new deployment id.** Payment integrations point at a deployment, so an integration made for the old one stops working (Merchant Center shows the connector status spinning and an error banner). Add a new integration on the new deployment and deactivate the old one.
- **Known issue:** on the demo project, with everything above in place, `payment-config` still returns `"paymentMethods":[]` without calling the processor. Ruled out: session, cart (incl. `country`), connector status and components, integration status and order, session token scope. If you hit this, ask commercetools support and quote the transaction id from the `payment-config` response; until then, consumers and guests can pay by bank transfer.
