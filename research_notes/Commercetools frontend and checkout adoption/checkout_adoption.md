# commercetools Checkout adoption vs custom checkouts with direct PSP integrations

Research date: 2026-10-30. Facts are labelled [FACT] (primary source says so) or [EST] (estimate or inference). Dates of sources are in brackets. Several docs.commercetools.com release-note pages returned 404 to direct fetches; their dates and titles come from search-engine snippets of those pages, so they are marked [FACT, snippet].

## 1. Launch, GA, regions and 2024-2026 status

### Takeaway
Checkout launched 9 May 2023 (Adyen and Worldpay pre-integrated), went GA 16 Oct 2023, and has been extended steadily since: Sydney (Jan 2024), Azure North America (Oct 2024), AWS regions (Mar 2026), Payment Intents API, Drop-in and Express Payments (Jan 2026), Recurring Orders beta (Oct 2026). No deprecation or repositioning found; it is now a built-in Merchant Center app.

### Cited Findings
- [FACT] Launched 9 May 2023 in Munich; "can be set up within days"; Worldpay and Adyen pre-integrated at launch, more planned; quotes from Worldpay and Adyen executives, no customer named. [2023-05-09] — [commercetools press release](https://commercetools.com/press-releases/commercetools-unveils-checkout-solution-turning-expanded-touchpoints-into-sales); [PR Newswire](https://www.prnewswire.com/news-releases/commercetools-unveils-checkout-solution-turning-expanded-touchpoints-into-sales-301818974.html)
- [FACT] GA on 16 Oct 2023 after a closed beta. [2023-10-16] — [Release note](https://docs.commercetools.com/checkout/releases/2023-10-16-commercetools-checkout-achieved-general-availability-status)
- [FACT] Available on Google Cloud Sydney (AU). [2024-01-30] — [Release note](https://docs.commercetools.com/checkout/releases/2024-01-30-commercetools-checkout-is-now-available-on-google-cloud-sydney)
- [FACT] Activation automated (no need to contact Checkout support) when added as Custom Application. [2024-07-23] — [Release note](https://docs.commercetools.com/checkout/releases/2024-07-23-automated-the-activation-of-commercetools-checkout)
- [FACT] Checkout became a built-in Merchant Center application. [2024-10-08] — [MC release](https://docs.commercetools.com/merchant-center/releases/2024-10-08-added-checkout-as-a-built-in-application); [Checkout release](https://docs.commercetools.com/checkout/releases/2024-10-08-checkout-is-now-a-built-in-merchant-center-application)
- [FACT, snippet] Checkout available on Azure in North America. [2024-10-08] — [Release note URL](https://docs.commercetools.com/checkout/releases/2024-10-08-checkout-available-on-azure-in-north-america)
- [FACT, snippet] Checkout available on AWS regions (specific regions not confirmed: page 404 to fetch). [2026-03-23] — [Release note](https://docs.commercetools.com/checkout/releases/2026-03-23-checkout-is-now-available-on-aws-amazon-web-services-regions)
- [FACT, snippet] Express Payments public beta (7 Jan 2026); Payment Intents API GA (21 Jan 2026); Payment predicates GA (23 Jan 2026); Drop-in Payment Integration Type GA (30 Jan 2026); multiple shipping methods in Payment Only GA (3 Feb 2026); iDEAL renamed iDEAL Wero (11 Feb 2026); customizable gift card messages (12 May 2026). — [Express Payments beta](https://docs.commercetools.com/checkout/releases/2026-01-07-introduced-express-payments-for-checkout-in-public-beta); [Payment Intents GA](https://docs.commercetools.com/checkout/releases/2026-01-21-checkout-payment-intents-api-is-now-generally-available); [Drop-in GA](https://docs.commercetools.com/checkout/releases/2026-01-30-checkout-drop-in-payment-integration-type-is-now-generally-available); [Checkout Releases index](https://docs.commercetools.com/checkout/releases)
- [FACT, snippet] Recurring Orders public beta (Checkout collects payment for each later order of a recurring cart; Recurring Payments / Recurring Payment Jobs APIs) [2026-10-07]; Browser SDK `onSubmit` property for custom pre-payment validation [2026-10-26]. — [Checkout Releases](https://docs.commercetools.com/checkout/releases); [API Releases](https://docs.commercetools.com/api/releases); [Release Notes](https://docs.commercetools.com/docs/release-notes?productArea=Learning&tab=product)
- [FACT, snippet] Checkout API support added to Composable Commerce SDKs. [2025-10-08] — [Release note](https://docs.commercetools.com/checkout/releases/2025-10-08-added-support-for-checkout-api-in-composable-commerce-sdks)
- [FACT] Two modes: Complete Checkout (address, shipping, payment selection, terms, summary, success/failure pages) and Payment Only (keeps your own checkout; Checkout adds payment selection and data entry and creates the Order). Hosted by commercetools. — [Checkout overview](https://docs.commercetools.com/checkout/overview)
- [FACT] Status page lists a planned Checkout maintenance in GCP EU region on 22 Jun 2026 (confirms an EU deployment). — [status.commercetools.com](https://status.commercetools.com/)
- [FACT] Beta features get support and fixes but no SLA; GA features are SLA-covered. — [Compatibility and lifecycle](https://docs.commercetools.com/offering/checkout-compatibility)
- [FACT] commercetools deprecated the older Adyen integration in commercetools Frontend; new projects should use the payment connector. [2024-08-02] — [Frontend release note](https://docs.commercetools.com/frontend-development/releases/2024-08-02-deprecation-of-adyen-integration)

### Inferences
- [EST] Region coverage now: GCP EU and presumably GCP US (original), GCP Sydney (AU), Azure NA, AWS (2026). The project in this repo (AWS us-east-2) could only run Checkout after 2026-03-23 if us-east-2 is among the AWS regions; verify on the hosts page.
- [EST] The release cadence (2026: Payment Intents, Drop-in, Express, Recurring) signals continued investment, not deprecation. The deprecation of the Frontend Adyen integration in favour of connectors suggests commercetools is steering payment work toward Checkout / Connect connectors.

### Gaps
- Exact AWS regions for Checkout (page not fetchable). Exact launch region list at GA (EU vs US) not confirmed from primary text.

## 2. Adoption numbers and named customers

### Takeaway
No public customer count or named case study for commercetools Checkout was found. commercetools itself discloses no total customer count; only GMV and brand names.

### Cited Findings
- [FACT] Search for Checkout-specific case studies returned only platform-level stories (Chemist Warehouse, PLUS, Vitamin Shoppe) that do not state they use the Checkout product. — [Chemist Warehouse](https://commercetools.com/customer-stories/chemist-warehouse); [PLUS](https://commercetools.com/customer-stories/plus-supermarkets); [Vitamin Shoppe](https://commercetools.com/customer-stories/the-vitamin-shoppe)
- [FACT] commercetools' B2C Checkout product page carries a testimonial from APG & Co (Australian fashion group); this is the only named customer tied to the checkout product page found. — [B2C Checkout page](https://commercetools.com/products/b2c/checkout); [APG & Co case study PDF](https://commercetools.com/assets/customers/customer-stories-pdf/commercetools-case-study-apgco-en.pdf)
- [FACT] Launch press release (2023) quoted only PSP partners (Worldpay, Adyen), no customers. — [Press release](https://commercetools.com/press-releases/commercetools-unveils-checkout-solution-turning-expanded-touchpoints-into-sales)
- [FACT] commercetools brand references: Audi, Danone, Eurail, NBCUniversal, Sephora; 89% willing to recommend (Gartner Peer Insights 2025). [2025-06] — [Press release](https://commercetools.com/press-releases/commercetools-recognized-as-a-customers-choice-in-gartner-report)
- [FACT] Customers process > $75B annualized GMV (as of Sep 2025). — reported in search summary of commercetools materials; primary page not fetched ([commercetools customer stories](https://commercetools.com/blog/categories/customer-stories))
- [EST] Third-party aggregator lists ~191 companies using commercetools (not a company disclosure). — [Prospeo](https://prospeo.io/t/commercetools-customers)

### Inferences
- [EST] Absence of named Checkout customers ~3.5 years after launch, while 2025 "top 15 customer stories" exist ([blog](https://commercetools.com/blog/top-commercetools-customer-stories)), suggests adoption is modest relative to the base (hundreds of enterprise customers), concentrated in newer or mid-market implementations (APG & Co type). Most large brands that went live 2018-2022 predate Checkout and built custom checkouts.

### Gaps
- No customer count, revenue share or attach rate for Checkout in any source found. Whether APG & Co uses Complete or Payment Only mode not verified.

## 3. Payment connectors and PSP integrations that bypass Checkout

### Takeaway
Checkout-compatible connectors listed in docs: Adyen and PayPal (built by commercetools), Stripe (third party), plus a template for custom PSPs. GitHub shows commercetools also maintains Connect payment repos for Braintree, Checkout.com and Cybersource. Separately, PSPs ship their own direct commercetools integrations (Adyen extension, Stripe Connect app, Worldpay, Mollie, Novalnet, Paydock, MONEI) used by custom checkouts.

### Cited Findings
- [FACT] Docs connector table: Adyen (commercetools; web components, drop-in, Express; ~25 methods incl. cards, Apple/Google Pay, Klarna, PayPal, SEPA, iDEAL Wero, Billie, BLIK, TWINT, Venmo); PayPal (commercetools; web components; PayPal only); Stripe (third party); Custom PSP (Organization Connector from template); Sample connector with credit card, invoice, purchase order (test/PoC only); gift card connectors. — [Connectors and Applications](https://docs.commercetools.com/checkout/connectors-and-applications)
- [FACT] New Adyen methods added through 2024-2025 (EPS, SEPA, TWINT, Bancontact 2024-07/08; Billie, BLIK, MobilePay, P24, Swish, Vipps 2025-03; Venmo 2025-06). — [2024-07-15](https://docs.commercetools.com/checkout/releases/2024-07-15-new-payment-methods-available-via-adyen); [2024-08-14](https://docs.commercetools.com/checkout/releases/2024-08-14-new-payment-methods-available-via-adyen); [2025-03-18](https://docs.commercetools.com/checkout/releases/2025-03-18-new-payment-methods-available-via-adyen); [2025-06-10](https://docs.commercetools.com/checkout/releases/2025-06-10-added-venmo-as-a-new-payment-method-available-via-adyen)
- [FACT] Worldpay was pre-integrated at launch (2023) but is not in the current docs connector table. — [Press release](https://commercetools.com/press-releases/commercetools-unveils-checkout-solution-turning-expanded-touchpoints-into-sales) vs [Connectors](https://docs.commercetools.com/checkout/connectors-and-applications)
- [FACT] commercetools blog describes routing payments across two PSPs (e.g. Adyen and PayPal by geography/currency/amount) in Checkout. — [Blog](https://commercetools.com/blog/set-up-checkout-with-two-psps-in-5-easy-steps)

GitHub activity (queried via GitHub API on 2026-10-30; stars, last push):

| Repo | Owner type | Purpose | Stars | Last push |
|---|---|---|---|---|
| [Adyen/adyen-commercetools](https://github.com/Adyen/adyen-commercetools) | PSP (originally commercetools) | Direct integration (API extension + notifications, Web Components), usable with any custom checkout | 56 | 2026-10-29 |
| [stripe/stripe-commercetools-connect-app](https://github.com/stripe/stripe-commercetools-connect-app) | PSP | Stripe payments via commercetools Connect | 18 | 2026-10-28 |
| [stripe/stripe-commercetools-checkout-app](https://github.com/stripe/stripe-commercetools-checkout-app) | PSP | Stripe for commercetools Checkout | 7 | 2026-10-28 |
| [commercetools/connect-payment-integration-template](https://github.com/commercetools/connect-payment-integration-template) | commercetools | Template for building PSP connectors | 10 | 2026-10-30 |
| [commercetools/connect-payment-integration-adyen](https://github.com/commercetools/connect-payment-integration-adyen) | commercetools | Checkout Adyen connector | 3 | 2026-10-28 |
| [commercetools/connect-payment-integration-paypal](https://github.com/commercetools/connect-payment-integration-paypal) | commercetools | Checkout PayPal connector | 1 | 2026-10-30 |
| [commercetools/connect-payment-integration-cko](https://github.com/commercetools/connect-payment-integration-cko) | commercetools | Checkout.com connector | 0 | 2026-10-30 |
| [commercetools/connect-payment-integration-braintree](https://github.com/commercetools/connect-payment-integration-braintree) | commercetools | Braintree connector | 0 | 2026-04-16 |
| [commercetools/connect-payment-integration-cybersource](https://github.com/commercetools/connect-payment-integration-cybersource) | commercetools | Cybersource connector | 2 | 2026-02-11 |
| [mediaopt/paypal-commercetools-connector](https://github.com/mediaopt/paypal-commercetools-connector) | Partner (Mediaopt) | PayPal connector (also Braintree demo) | 2 | 2026-10-27 |
| [Worldpay/Worldpay-CommerceTools-CG](https://github.com/Worldpay/Worldpay-CommerceTools-CG) | PSP | Worldpay integration | 3 | 2025-12-15 |
| [mollie/commercetools-connector](https://github.com/mollie/commercetools-connector) | PSP | Mollie Connect connector (old [mollie/commercetools](https://github.com/mollie/commercetools) archived) | 4 | 2026-06-16 |
| [Novalnet-Technic/novalnet-commercetools-payment-connector](https://github.com/Novalnet-Technic/novalnet-commercetools-payment-connector) | PSP | Novalnet connector | 0 | 2026-02-09 |
| [MONEI/connect-payment-integration-monei](https://github.com/MONEI/connect-payment-integration-monei) | PSP | MONEI (Bizum, cards) | 1 | 2026-09-29 |
| [PayDock/e-commerce-commercetools-payment-connector](https://github.com/PayDock/e-commerce-commercetools-payment-connector) | PSP | Paydock / CommBank PowerBoard (AU) | 0 | 2024-11-11 |
| [davesklarna/ct-klarna-plugin](https://github.com/davesklarna/ct-klarna-plugin) | individual (Klarna employee name, unverified) | Klarna plugin | 0 | 2025-07-17 |
| [commercetools/commercetools-payone-integration](https://github.com/commercetools/commercetools-payone-integration), [commercetools-paypal-plus-integration](https://github.com/commercetools/commercetools-paypal-plus-integration) | commercetools | Pre-Connect direct integrations | 7 / 7 | archived 2022-2023 |

- [FACT] The Adyen direct integration requires a commercetools Payment with `paymentInterface = ctp-adyen-integration` (API extension model, independent of Checkout). — [Web Components guide](https://github.com/commercetools/commercetools-adyen-integration/blob/master/extension/docs/WebComponentsIntegrationGuide.md)
- [FACT] commercetools Frontend had a built-in Adyen Drop-in integration (now deprecated in favour of the connector). — [Frontend Adyen docs](https://docs.commercetools.com/frontend-development/adyen); [Deprecation 2024-08-02](https://docs.commercetools.com/frontend-development/releases/2024-08-02-deprecation-of-adyen-integration)

### Inferences
- [EST] Star counts are low across the board (all < 60), so GitHub is weak evidence of adoption; but the Adyen direct integration has 3x the stars of any Connect connector and is the longest-lived, consistent with most existing customers using direct PSP integrations under custom checkouts.
- [EST] Stripe maintaining two repos (Connect app for any checkout, plus a Checkout app) shows PSPs hedge: they support both paths.
- [EST] Connect connectors (template-based) can be used in Payment Only mode with a custom checkout UI, which blurs the "Checkout vs custom" split: many teams may use a Connect connector with their own UI.

### Gaps
- Marketplace listing count for payment providers: marketplace.commercetools.com now redirects to commercetools.com/partners (301), not fetched. Klarna official connector not found. Checkout.com/Braintree/Cybersource connectors not yet listed in Checkout docs table (status unclear).

## 4. How named large customers handle checkout

### Takeaway
Could not verify the checkout architecture of any named large commercetools customer from public sources. Table below records what is and isn't known.

### Cited Findings
| Customer | Checkout approach | Evidence |
|---|---|---|
| APG & Co | Testimonial on commercetools B2C Checkout product page (implies Checkout use; mode unknown) | [B2C Checkout](https://commercetools.com/products/b2c/checkout) |
| Chemist Warehouse | Checkout rebuilt during replatform, +21% orders YoY in 6 months; product used not stated | [Story](https://commercetools.com/customer-stories/chemist-warehouse) |
| PLUS Supermarkets | +89% successful orders; checkout computes orders/promotions; product not stated | [Story](https://commercetools.com/customer-stories/plus-supermarkets) |
| The Vitamin Shoppe | Cart and checkout rolled out after initial phase; product not stated | [Story](https://commercetools.com/customer-stories/the-vitamin-shoppe) |
| Breville, Christie Cookie Co. | Custom checkout flows (subscription + one-time in one checkout; multi-ship up to 500 addresses) | [Blog: Commerce Capabilities 101: Checkout](https://commercetools.com/blog/commerce-capabilities-101-checkout) |
| Audi, Sephora, Danone, NBCUniversal, Eurail | Not disclosed | [Press release 2025](https://commercetools.com/press-releases/commercetools-recognized-as-a-customers-choice-in-gartner-report) |

### Inferences
- [EST] Breville and Christie Cookie flows (subscriptions mixed with one-time items, 500-address multi-ship) exceed what Complete Checkout configures, so they are custom checkouts.

### Gaps
- No public evidence on PSP or checkout product for Audi, Sephora, L.L.Bean, John Lewis, River Island, Panasonic etc. Conference talks or PSP case studies were not found in the searches.

## 5. Limitations, pricing, B2B and agency views

### Takeaway
Checkout is a separately licensed add-on with no public price. Documented limits: Payment Only lacks address/shipping and discount codes; customisation is limited to styling, texts, address forms and routing rules; invoice/PO only in the sample connector; docs say nothing about B2B (business units, approvals, quotes).

### Cited Findings
- [FACT] Payment Only: no address or shipping method functionality; customise only style, texts/labels and payment integrations. Discount codes only in Complete Checkout. At least one connector required. — [Overview](https://docs.commercetools.com/checkout/overview)
- [FACT] Complete Checkout customisation: font and colours, texts, address forms and validation, payment integrations, rule-based routing (country, cart contents), multiple Applications per Project per brand or country. — [Overview](https://docs.commercetools.com/checkout/overview)
- [FACT] Drop-in: no payment predicates or label customisation; only one of web components or drop-in active at a time; Express buttons' labels for Google Pay, Apple Pay, PayPal not changeable. — [Connectors and Applications](https://docs.commercetools.com/checkout/connectors-and-applications)
- [FACT] Invoice and purchase order appear only in the sample payment connector, for test and proof-of-concept. — [Connectors and Applications](https://docs.commercetools.com/checkout/connectors-and-applications)
- [FACT] Docs overview contains no pricing; getting started requires confirming a Subscription. — [Overview](https://docs.commercetools.com/checkout/overview)
- [EST/secondary] Checkout is sold as an add-on alongside B2B and Premium Support; commercetools base from ~ $50k/yr (third-party). — [ecommerceguide](https://ecommerceguide.com/platforms/commercetools/) (via search summary; page returned 429)
- [EST/secondary] No public rate card; prices negotiated; third-party figures conflict ($40k-$500k/yr). — [CostBench](https://costbench.com/software/enterprise-ecommerce/commercetools/); [Swell: limitations](https://www.swell.is/content/commercetools-limitations)
- [FACT] This repository's own implementation (B2B sandbox, ctwara) uses Checkout Payment Only for consumers and guests by card, and keeps business buyers on a custom invoice + PO flow (`placeOrderAction`). — local CLAUDE.md / docs/checkout-setup.md (internal, not a public source)

### Inferences
- [EST] For B2B, Checkout covers card payments only in practice; invoice/PO, approval flows and quote-to-order remain custom, which matches this repo's split design.
- [EST] Extra license cost plus limited UI control push large brands with existing PSP contracts toward custom checkout + direct PSP integration or Payment Only mode.

### Gaps
- No agency blog with a substantive hands-on evaluation of commercetools Checkout was found within the call budget. No public list price for Checkout. No statement on multi-store (Store-scoped) behaviour beyond per-country/brand Applications.
