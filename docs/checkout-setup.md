# commercetools Checkout setup (card payments)

Consumers and guests pay by card through **commercetools Checkout** in **Payment Only** mode. Our checkout page collects the address and delivery method. Checkout then shows the payment methods, takes the payment through a Connector and creates the Order. Business buyers keep ordering on invoice with a PO number.

The code is ready. These one-time steps happen in Merchant Center, in your project. Below, `<project-key>` is your project key and `<region>` its region as in `CTP_API_URL` (for example `us-east-2.aws`).

## 1. Turn on Checkout

Merchant Center → **Checkout** → **Get started** → **Let's proceed** → **Confirm creation**. This confirms Checkout's predefined permissions and Subscription.

## 2. Install a payment Connector

The connector needs its **own** API client (Settings → Developer settings → Create new API client) with these scopes, ticked by hand: Manage *Orders*, *Payments*, *Types*; View *Checkout sessions*, *Types*; Tokens *Introspect OAuth Tokens*, *View API clients*. They match the connector template's `connect.yaml`, whose status check needs all but `view_types`. The "all access" / admin template does **not** include the two Tokens scopes. The Set up Checkout learning guide lists a different set that includes `manage_checkout_payment_intents`; the template's status check doesn't require it, the PayPal connector's does. Enter the client's ID and secret when installing the connector.


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
- **Specification of the payments integration:** web components (the connector template offers no drop-in)
- **Payment method:** credit card
- **Payment integration name:** Card

**Save**, then switch the integration's **Status** on. Finally switch the **Application's Status** on.

## 5. Test

Sign in as the test consumer from `.env.demo` (or check out as a guest). Add a spare part, go to checkout, choose the address and delivery method, then choose **Credit or debit card**: the card form opens inside that option.

Test cards from the sample Connector:

| Card | Number |
|---|---|
| Visa | 4111 1111 1111 1111 |
| Mastercard | 5555 5555 5555 4444 |
| American Express | 3419 2595 0237 632 |

For all three, use any future expiry date, any 3 or 4 digit CVC, and any name.

## PayPal

PayPal runs through the same Checkout Application, on the official connector (`connect-payment-integration-paypal`). Set up the steps above first. On `ctwara` (7 November 2026) the integration `ironline-paypal` is on the `ironline-payment` Application: checkout shows PayPal next to Credit Card and loads the PayPal sandbox button, but no PayPal payment has been completed yet. Merchant Center marks the connector "Incorrect configuration" (its health check reports a "commercetools permissions" problem), as it does the sample connector; both still load. A new integration starts deactivated: switch it on after saving.

1. In the PayPal developer dashboard, create a sandbox app and note its client ID and secret.
2. Create a separate commercetools API client with the seven scopes from step 2 plus `manage_checkout_payment_intents` (the PayPal connector's `connect.yaml` lists it and its status check requires it).
3. Merchant Center → **Connect** → marketplace: install the PayPal connector with those values, `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET` and `PAYPAL_ENVIRONMENT`. Wait until it shows **Deployed**.
4. In the `ironline-payment` Application → **Payment integrations**, add an integration on that connector (web components, the only type it supports) and switch it on.
5. Set `CHECKOUT_PAYPAL=true` in the deployment (and `B2C_CARD_PAYMENTS=true` if cards are offered too). The payment step then lists **PayPal** as its own method (button **Continue with PayPal**), and the CSP on per-request pages allows `*.paypal.com` and `*.paypalobjects.com` (`connect-src`, `frame-src`, `img-src`, `style-src`). Scripts need no entry: `'strict-dynamic'` trusts what Checkout's script loads.

**One list of payment methods:** the payment step shows its own radio buttons (card, PayPal, bank transfer; purchase order for business buyers), then one billing address for all of them, then the chosen method's button. Checkout always lists every active method of the Application, and neither its session nor its SDK can limit that, so `CardPayment.tsx` clicks Checkout's radio for the chosen method and hides Checkout's own list around it (`features/checkout/checkout-method.ts`, which records the markup it relies on). Hiding starts only once that radio is found, so if commercetools changes Checkout's markup, the buyer sees Checkout's own list again and can still pay. Switching between card and PayPal keeps the same session; other methods wait until the payment is finished or cancelled.

**Billing address:** consumers and guests get "My billing and shipping address are the same" (ticked by default). Unticked, consumers pick a saved address or enter a new one, guests enter one, and **Update** saves it on the cart (`saveBillingAddress`); paying waits until it is saved. A billing address chosen this way stays when the shipping address changes (`ownBilling`). Business buyers are billed at their company's address.

`CHECKOUT_PAYPAL` only adds the PayPal radio and the CSP hosts. What Checkout really offers comes from the Application, so keep the two in step. The PayPal connector offers PayPal only, so cards need a second connector. For PayPal only, also switch off the card integrations on the Application: then Checkout has nothing else to show even if hiding its own list stops working.

Orders count as PayPal when a Payment's `paymentMethodInfo.method` or `paymentInterface` contains "paypal" (`paymentKind`); the order page, guest confirmation, PDFs and email then say so. Check this on the first sandbox payment: the connector's code sets `paymentInterface`, but the values stored through Checkout have not been seen on a real Payment.

To test: use a PayPal sandbox buyer account, and watch the browser console for CSP errors and for the `checkout …` lines (below). If PayPal doesn't show, check the `config` response in the browser's network tab: its `connectors` must list the PayPal connector's deployment, otherwise the integration isn't on the Application or isn't switched on.

## Braintree (cards)

Braintree has no connector for the AWS regions in the marketplace (its region list is empty for `ctwara`), so it runs from a fork as an organization connector: `sohelrana09/braintree-commercetools-connector`, tag `1.0.34-aws.1`, with `connect.yaml` set to `us-east-2.aws` and the events app removed (it only takes Google Cloud Pub/Sub messages). On `ctwara` (7 November 2026) it is a Preview deployment (trial projects can't use the production type), and the Application has **Card (Braintree)** (key `braintree-card`, method `card`) switched on. The sample connector's card integration is switched off: with two card integrations Checkout lists two card radios and the storefront picks the first.

Set `CHECKOUT_BRAINTREE=true` next to `B2C_CARD_PAYMENTS=true`. It changes no method, only the CSP on per-request pages: `*.braintreegateway.com` (card fields and client API), `*.braintree-api.com` (GraphQL API), `*.cardinalcommerce.com` and `*.cardinaltrusted.com` (Cardinal, 3-D Secure), in `connect-src`, `frame-src`, `img-src` and `style-src`, plus `*.cardinalcommerce.com` in `form-action` (Cardinal posts its device-fingerprint and challenge forms from the page). Cardinal's sandbox also sends logs to an `execute-api.us-east-1.amazonaws.com` host; that stays blocked (it only logs). Without it, Braintree's card fields stay empty and Checkout says "3D Secure could not be initialized". Test with Braintree's sandbox cards (`4111 1111 1111 1111`, any future date).

**Look:** the card form is the connector's own (its enabler), so its labels, fields and focus colours are set in the fork (`enabler/src/components/CreditCard/CreditCardMask.tsx`, `enabler/src/styles/index.tsx`, `enabler/src/index.css`; tag `1.0.34-aws.2` matches the storefront's inputs). Its card fields are Braintree iframes and take their font from the fork, not from the page. The pay button is Checkout's: `checkoutLookCss` (`features/checkout/checkout-method.ts`) gives it the storefront's orange, and Checkout's form the page's font; its text is the integration's pay button label (Merchant Center, the integration's "Display of the payment method", Custom details).

**Speed:** Checkout builds the card form in the browser through a chain of requests, each waiting for the one before: Checkout's config and cart, the connectors' enabler scripts and Checkout's payment config, the connectors' `operations/config`, the card connector's `POST /payments` (it creates the Payment and Braintree's client token; the slowest step, about 2.3 s from Asia on the Preview deployment), then Braintree's GraphQL API. Measured on 8 November 2026 from Asia: about 6.4 s from the SDK starting to the fields showing. What the storefront does about it:

- The form loads in the background as soon as the cart has an address and a method, whatever payment method is selected (`PaymentMethods.tsx` keeps it mounted), so choosing card shows it at once once it has loaded.
- `CHECKOUT_PRELOAD` (comma-separated URLs) opens connections to the connector's hosts while the page loads and fetches a `.js` URL (the enabler) ahead of time. For `ctwara`: the Braintree deployment's `https://assets-<id>…/connector-enabler.es.js`, its `https://service-<id>…` URL, and `https://payments.sandbox.braintree-api.com`. Connect shows both connector URLs on the deployment; they change when the connector is deployed again.
- Every connector in the Application loads its scripts and config, even with its integrations switched off: delete the old sample connector's integrations from the Application (Merchant Center) so only Braintree's load.

The rest is inside Checkout and the connector: a production (not Preview) deployment, and a `POST /payments` that makes its commercetools and Braintree calls in parallel (in the fork), would shorten it further.

Braintree's connector also offers ACH, Apple Pay, Google Pay and PayPal as payment methods; none of them is added yet, and the storefront's radios only know card and PayPal.

## Which methods are offered

Each payment method for consumers and guests has its own switch, all off by default (`src/lib/commercetools/checkout-session.ts`). Business buyers always order on invoice.

| Variable | Offers |
|---|---|
| `B2C_CARD_PAYMENTS=true` | Credit or debit card, through Checkout |
| `CHECKOUT_PAYPAL=true` | PayPal, through Checkout |
| `B2C_BANK_TRANSFER=true` | Bank transfer, placed directly |
| `CHECKOUT_BRAINTREE=true` | No method: allows Braintree's hosts in the CSP when cards go through Braintree |

They appear in that order and the first one is selected; with only one on, it shows without a choice. With all three off, the payment step says online ordering isn't available and the environment check warns. A change in Vercel needs a redeploy.

## Bank transfer next to Checkout

With bank transfer and card or PayPal on, consumers and guests choose between them with radio buttons. The choice locks while a payment is opening or open. Set `BANK_TRANSFER_EXPIRY_DAYS` too, or unpaid orders hold their stock forever.

A buyer can give up on a card or PayPal attempt and then choose bank transfer. Checkout may have left its Payment on the cart, so `placeBankTransferOrder` removes it first; otherwise the order would count as paid online and never get its bank-transfer Payment. A Payment that is running or took money keeps the cart locked.

## How it fits together

- `src/lib/commercetools/checkout-session.ts` creates the Checkout Session on `https://session.<region>.commercetools.com/<project-key>/sessions`. It uses an admin-client token narrowed to `manage_sessions` and `manage_orders` for the B2C store.
- `startCardPayment` (`features/checkout/actions.ts`) first reads the cart with the buyer's own token. The cart must be theirs, be the version they reviewed, have a delivery address, method and email, and contain no quote-only machines. Consumers must also have a confirmed email. Only then does it open the session.
- Carts: commercetools documents that Checkout can only be initialized for Carts created with the Carts API. Consumer and guest carts here come from My Carts (`/in-store/key={store}/me/carts`); Checkout reads them and lists the payment methods (checked on `ctwara`), but no real payment has run on one yet.
- Checkout only pays **Active** carts: a Frozen cart gets `cart_invalid_state` and "Unable to proceed with the checkout". So the storefront doesn't freeze the cart (below).
- `CardPayment.tsx` runs `paymentFlow()` from `@commercetools/checkout-browser-sdk` inline (`<div data-ctc>`). On `checkout_completed`, `finishCardPayment` reads the new order with the buyer's token, checks that it came from their cart, clears the cart, and opens the order page. Guests go to `/order-confirmation/[id]`.

## The reviewed total is the charged total

When the payment step opens the Checkout session, the storefront stores it as the cart's **payment lock**: Custom Object `checkout-session/<cart id>` with the session, the total the buyer reviewed and when the lock started. While the lock is fresh, the storefront refuses changes to that cart (from any tab) with a message pointing to checkout, where **Cancel payment and change my cart** removes it. A reload or a second tab gets the same session for 15 minutes instead of a second one that could also charge. A lock older than 30 minutes (an abandoned payment) is removed by the next change, unless a payment on the cart is running or took money. Code: `src/features/cart/payment-lock.ts` (pure, tested), the lock reads and writes and `updateMyCart` in `src/features/cart/service.ts`, `prepareCardPayment` in `src/features/checkout/service.ts`.

**Card and PayPal open on their own, with a soft lock.** The card fields and PayPal's button only exist inside a Checkout session, so when card or PayPal is selected and steps 1 and 2 are saved, `CardPayment.tsx` opens the session without a click. The chosen method's body (billing address, then the card fields or PayPal's button) shows inside its option box (`PaymentMethods.tsx`; one element moved by flex `order`, so switching between card and PayPal keeps the session and its form). **Pay by card** and **Continue with PayPal** stay as the fallback when opening fails. A loading line shows until the method's fields or button are there (`methodReadySelector`), Checkout's half-built form stays out of sight meanwhile (`buildingCss`), and after 12 s it shows anyway. The buyer hasn't asked to pay yet, so this lock is soft (`soft: true`): any cart change removes it (the cart page, steps 1 and 2, the billing address) unless a payment on the cart is running or took money, and it doesn't count as an open payment on the cart and checkout pages. While the buyer edits steps 1 and 2 or the billing address, the payment step closes the session; once saved, it opens a new one for the new total. Pressing Checkout's card pay button makes the lock full (`holdCardPayment`), as **Pay by card** does. PayPal's button is a frame whose clicks the page can't see, so a PayPal payment keeps the soft lock: once its payment is running, cart changes are refused anyway, and a total that changed before is flagged on the order page.

**Speed.** Measured locally from Asia: about 3.5 s for the server action that opens the session, then about 8 s of Checkout building its form in the browser (Checkout config and cart 1.6 s, connector scripts and payment config 0.9 s, the connectors' config 1.4 s, the Braintree processor's `/payments` 2.7 s, Braintree's GraphQL 0.9 s). Opening the session on selection takes all of it off the buyer's click; the SDK is fetched when the payment step mounts and `PaymentStep` preconnects to Checkout's hosts. The rest is Checkout's and the connectors' own chain: the Braintree processor's `/payments` is the longest step to look at in the fork.

The storefront used to freeze the cart instead (`freezeCart`, HardFreeze), which also kept prices and discounts fixed, but Checkout refuses Frozen carts. A cart frozen by that older code is unfrozen the next time it is changed or paid. Without the freeze, a price or discount can still change while the buyer pays: `finishCardPayment` compares the order with the reviewed total, and the order page says so (`?changed=1`). Business carts never have a lock and never pay through Checkout.

## After-order processing (all payment paths)

Every order, however it was created (invoice + PO, bank transfer, card through Checkout, order from a quote), goes through `processOrder` in `src/features/order-processing/service.ts`. It gives the order its number (`ORD-2026-000123`, prefix from `ORDER_NUMBER_PREFIX`) and runs the after-order steps once each. Three callers, so it still happens when the buyer closes the tab right after paying:

1. **The order action**, right after the order exists. It numbers the order before the buyer sees it and runs the rest after the response. This alone covers invoice, bank transfer and quote orders, and card orders whose browser comes back.
2. **A commercetools Subscription** (`storefront-order-events`: `OrderCreated`, `OrderPaymentStateChanged`, `PaymentTransactionAdded`, `PaymentTransactionStateChanged`). Subscriptions deliver to a queue, not a URL:
   1. Merchant Center → Settings → Project settings → **Messages**: switch them on (they are off in the demo project; without them the Subscription delivers nothing).
   2. Set `ORDER_EVENTS_SECRET` (at least 32 random characters) in the deployment.
   3. Queue side as for the cache refresh (`docs/cache-refresh.md`, step 3), with an EventBridge API destination `POST https://<public storefront>/api/order-events` and the header `Authorization: Bearer <ORDER_EVENTS_SECRET>`.
   4. `npm run ct:order-subscription -- --eventbridge <aws-account-id>` shows what it will do; add `--yes` to create it.
   The endpoint answers 500 when a step failed, so the queue retries.
3. **A sweep** for anything both missed: `GET /api/cron/order-sweep` with `Authorization: Bearer <CRON_SECRET>` processes orders from the last 72 hours that have no number or unfinished steps, walking the window by id for up to 100 seconds (the response says `more` when it didn't fit). It then cancels bank-transfer orders past `BANK_TRANSFER_EXPIRY_DAYS`, finishes restocks that failed and raises orphan payments. `vercel.json` schedules it once a day, the most a Hobby plan allows (a tighter schedule makes Vercel refuse the deployment). On a daily sweep, the order Subscription is what retries a failed step within minutes; without it, a failed step, an orphan payment alert or a restock retry can wait up to a day. On Pro, use `*/15 * * * *`.

The steps after numbering:

- **Payment** (all orders not paid by card): a Payment with key `order-<order id>`, `paymentMethodInfo.method` `invoice` (business orders, including orders from quotes) or `bank-transfer` (consumers and guests), planned amount = the order's gross total, linked to the order, whose payment state becomes **Pending**. Finance (or the ERP) marks it Paid. Card orders keep the Payment Checkout created. The runtime API client needs **`manage_payments`**. Scopes can't be changed on an existing API client, so create a new one with the runtime scopes (`RUNTIME_SCOPES` in `src/lib/commercetools/scopes.ts`) and put it in `CTP_CLIENT_*`; `npm run setup -- --check` reports a missing scope. When an approver rejects an order, the storefront cancels it and, in the same update, sets a Pending payment state to **Failed** (commercetools has no cancelled payment state); our Payment then gets status code `cancelled` ("Order cancelled before payment"). A cancelled order never gets a Payment; card Payments are left to Checkout. Without it the step fails and is retried; the order itself is unaffected.

- **Confirmation email** (all orders): plain text built from the same data as the confirmation PDF, sent through `src/lib/mailer.ts` (Resend in production; printed to the dev server log otherwise) to the order's email. A failed send is retried. When you first deploy this with the sweep switched on, orders from the last 72 hours that predate it get their number, Payment and confirmation too.

How "once" is guaranteed: the order number is set with the order's version (a second worker gets a 409 and sees the number), and whoever sets it creates the marker Custom Object `order-processing/<order id>`. Each later step is claimed by writing that marker with its version; a claim older than 10 minutes counts as abandoned and may be taken over. Numbers come from the Custom Object `order-number/<prefix>-<year>`; they are unique and increasing, but a number taken by a worker that loses the race is skipped, so the sequence can have gaps.

## Browser tests that place orders

`E2E_ORDERS=1 npm run test:e2e -- --project=orders` runs `e2e/orders`: guest and consumer bank transfer, business invoice with a PO, an order above the approval rule (rejected by the approver) and the card path with Checkout stubbed out, which checks that an open payment locks the cart and that cancelling unlocks it. They are off by default because they place real orders. Each order is cancelled afterwards and its reserved stock added back with a client that has `manage_orders` and `manage_products` (`E2E_CLEANUP_CLIENT_ID` / `E2E_CLEANUP_CLIENT_SECRET`, else the runtime client); without one the tests skip before ordering. The business tests order from a fresh cart they create for the buyer and point the browser at (the `ct_cart_<unit>` cookie), so the demo buyer's own carts are never touched; an unused test cart is deleted. Order numbers they use are not given back. The consumer test needs `E2E_CONSUMER_EMAIL` and `E2E_CONSUMER_PASSWORD` (a confirmed account with a saved address). A real card payment, the email itself and the Subscription are not covered.

## Troubleshooting

- **"Online payment is unavailable right now"** plus `init_error` and a CORS error in the browser console: Checkout's config API (`https://checkout.<region>.commercetools.com/api/<project-key>/config`) could not find an active Application with the key we send, or this site's origin isn't allowed. The CORS error follows from that 404; it isn't a separate problem.
- To see which Applications exist, query the Applications API (scope `view_checkout_applications`): `GET https://checkout.<region>.commercetools.com/<project-key>/applications`.
- To see installed Connectors, query the Connect API (scope `view_connectors_deployments`): `GET https://connect.<region>.commercetools.com/<project-key>/deployments`.
- Make sure the Merchant Center project switcher shows your project while you set up.
- The marketplace name of the test connector is **"Sample payment connector for checkout"** (key `connect-payment-integration`). After installing it, wait until its deployment shows **Deployed** in Connect (this can take several minutes); only then can a payment integration use it.
- `payment-config` answering `"paymentMethods":[]` means Checkout found no usable payment method for this session (it then shows "An error occurred. Please try again." in the payment area). The documented reasons are an inactive integration or Application and a predicate that is false for the cart. The endpoint itself is undocumented and its other filters are not published. Also worth checking, as a project observation and not documented behaviour: the processor's API client holding `manage_payments`, `manage_orders`, `view_sessions`, `view_api_clients`, `introspect_oauth_tokens`, `manage_types`, `view_types`.
- **`/api/{project}/config` answers 401 "Session not found"** although the Sessions API can read the session: Checkout itself can't read sessions. This happens when Checkout's own permissions or API client were removed (for example while rotating API keys). Redo step 1 (Checkout → Get started → confirm permissions and Subscription).
- Rotating `CTP_CLIENT_SECRET` signs everyone out and empties guest carts in the browser: the session and guest cookies are encrypted with a key derived from it.
- **Config 200 but `payment-config` returns `"connectors":[]`** with a Deployed connector: the project's working assumption is that Checkout drops a connector whose processor fails its status check, but no source confirms that Checkout runs this check here. Open Manage organizations & teams → Connect → Manage connectors → the deployment → logs, and check the processor's API client has all seven scopes (`view_api_clients` and `introspect_oauth_tokens` are the ones most often missed).
- **Redeploying or reinstalling the connector creates a new deployment id.** Payment integrations point at a deployment, so an integration made for the old one stops working (Merchant Center shows the connector status spinning and an error banner). Add a new integration on the new deployment and deactivate the old one.
- **"Unable to proceed with the checkout" or no payment methods:** in development, every Checkout message is logged in the browser console as `checkout info|warn|error <code>` (`CardPayment.tsx`). Seen on `ctwara`: `cart_invalid_state` (a Frozen cart: Checkout pays only Active carts) and a CSP block on Checkout's own stylesheet (`684.css`) or Google Fonts, which stops Checkout before it asks for payment methods; the CSP now allows both (`style-src`, `font-src`). Either one stops the payment step before the connector is called. With both fixed (7 November 2026), `payment-config` lists the sample connector's card integration. Earlier reports of `"paymentMethods":[]` were never traced further; if it comes back, look at the integration's status and predicate and the Application's countries.
