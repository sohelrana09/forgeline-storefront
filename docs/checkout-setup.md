# commercetools Checkout setup (card payments)

Consumers and guests pay by card through **commercetools Checkout** in **Payment Only** mode. Our checkout page collects the address and delivery method. Checkout then shows the payment methods, takes the payment through a Connector and creates the Order. Business buyers keep ordering on invoice with a PO number.

The code is ready. These one-time steps happen in Merchant Center (project `ctwara`).

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

- `src/lib/commercetools/checkout-session.ts` creates the Checkout Session on `https://session.us-east-2.aws.commercetools.com/ctwara/sessions`. It uses an admin-client token narrowed to `manage_sessions` and `manage_orders` for the B2C store.
- `startCardPayment` (`features/checkout/actions.ts`) first reads the cart with the buyer's own token. The cart must be theirs, be the version they reviewed, have a delivery address, method and email, and contain no quote-only machines. Consumers must also have a confirmed email. Only then does it open the session.
- `CardPayment.tsx` runs `paymentFlow()` from `@commercetools/checkout-browser-sdk` inline (`<div data-ctc>`). On `checkout_completed`, `finishCardPayment` reads the new order with the buyer's token, checks that it came from their cart, clears the cart, and opens the order page. Guests go to `/order-confirmation/[id]`.

## Troubleshooting

- **"Card payment is unavailable right now"** plus `init_error` and a CORS error in the browser console: Checkout's config API (`https://checkout.us-east-2.aws.commercetools.com/api/ctwara/config`) could not find an active Application with the key we send, or this site's origin isn't allowed. The CORS error follows from that 404; it isn't a separate problem.
- To see which Applications exist, query the Applications API (scope `view_checkout_applications`): `GET https://checkout.us-east-2.aws.commercetools.com/ctwara/applications`.
- To see installed Connectors, query the Connect API (scope `view_connectors_deployments`): `GET https://connect.us-east-2.aws.commercetools.com/ctwara/deployments`.
- Make sure the Merchant Center project switcher shows **ctwara** while you set up.
- The marketplace name of the test connector is **"Sample payment connector for checkout"** (key `connect-payment-integration`). After installing it, wait until its deployment shows **Deployed** in Connect (this can take several minutes); only then can a payment integration use it.
- `payment-config` answering `"paymentMethods":[],"connectors":[]` means Checkout has no usable payment integration: none active, or the connector's processor fails its status check. The most common cause is the processor's API client missing one of `manage_payments`, `manage_orders`, `view_sessions`, `view_api_clients`, `introspect_oauth_tokens`, `manage_types`, `view_types` (Checkout then shows "An error occurred. Please try again." in the payment area).
- **`/api/{project}/config` answers 401 "Session not found"** although the Sessions API can read the session: Checkout itself can't read sessions. This happens when Checkout's own permissions or API client were removed (for example while rotating API keys). Redo step 1 (Checkout → Get started → confirm permissions and Subscription).
- Rotating `CTP_CLIENT_SECRET` signs everyone out and empties guest carts in the browser: the session and guest cookies are encrypted with a key derived from it.
- **Config 200 but `payment-config` returns `"connectors":[]`** with a Deployed connector: Checkout drops connectors whose processor fails its status check. Open Manage organizations & teams → Connect → Manage connectors → the deployment → logs, and check the processor's API client has all seven scopes (`view_api_clients` and `introspect_oauth_tokens` are the ones most often missed).
- **Redeploying or reinstalling the connector creates a new deployment id.** Payment integrations point at a deployment, so an integration made for the old one stops working (Merchant Center shows the connector status spinning and an error banner). Add a new integration on the new deployment and deactivate the old one.
- **Still open (25 Oct):** with everything above in place, `payment-config` returns `"paymentMethods":[]` without calling the processor. Checked and ruled out: session, cart (incl. `country`), connector status and components, integration status and order, session token scope. Next step: ask commercetools support, quoting the transaction id from the `payment-config` response.
