# Custom builds dominate commercetools storefronts and checkouts

**Bottom line:** commercetools publishes no adoption figures for either product, so every share in this report is an estimate. The evidence still points one way. Most commercetools Composable Commerce customers run a **custom-built frontend** and a **custom-built checkout** wired directly to a payment provider (PSP). commercetools Frontend and commercetools Checkout each serve a small minority, mostly mid-market brands. My estimate is under 20% of customers for Frontend and probably fewer for Checkout, with most Checkout use in Payment Only mode under a custom UI. That is the same pool Forgeline targets: teams that build their own head and need B2B flows that neither product covers. My recommendation is a **conditional go**. Forgeline is worth the time as an open-source reference build and as a source of agency and consulting work, not as a product to sell. Three conditions apply: it gets a permissive license now, it stays maintained, and it stands out from commercetools' own AI-generated storefront path by being a tested, working B2B app. Labels used below: **[Fact]** means a primary or named source says it; **[Vendor claim]** is a commercetools marketing figure; **[Estimate]** is a third-party figure or my own inference.

## About 600 customers, and roughly ten named Frontend users

The base itself is fuzzy. commercetools claims **"more than 600 global brands"** in its July 2026 boilerplate, while the footer of the same page says "500+ enterprises" [Vendor claim] ([commercetools](https://commercetools.com/press-releases/commercetools-launches-modular-commerce-offerings)). BuiltWith detects **2,432 live commercetools sites** [Estimate] ([BuiltWith](https://trends.builtwith.com/shop/commercetools)). That number counts domains rather than customers, and it cannot tell which frontend a site uses.

No source gives a count or share of Frontend customers. The named Frontend users come to about ten brands, mostly European, and the names have barely changed since 2021 to 2023: flaconi, CHRONEXT, Lakrids by Bülow and Tom Tailor at the 2023 launch, plus APG & Co, Christie Cookie Co., BIC and Loomstate on today's product page [Fact] ([launch release](https://commercetools.com/press-releases/commercetools-launches-commercetools-frontend-to-help-businesses-take-advantage-of-a-composable-tech-without-sacrificing-time-to-market); [Frontend page](https://commercetools.com/products/frontend)). The flagship enterprise references (Audi, Sephora, Danone, NBCUniversal, Ulta) are not shown as Frontend users. Where an architecture is public, it is in-house: Moonpig runs in-house applications on a best-of-breed stack ([Moonpig story](https://commercetools.com/customer-stories/moonpig)), and ETAM's own development team is leading its 2026 build ([Agile Brand Guide](https://agilebrandguide.com/yesterdays-marketing-technology-ai-news-october-28-2026)).

The best rough number comes from npm. `@commercetools/frontend-sdk` gets **14,475 downloads a month**, against **639,390** for `@commercetools/platform-sdk`, about 2% [Fact for the counts, Estimate as a proxy] ([npm](https://api.npmjs.org/downloads/point/last-month/@commercetools/frontend-sdk)). CI runs and the SDK's partial use skew that ratio. Even so, it fits a Frontend share well under 20% [Estimate].

The vendor's direction matters more than the count. Frontend is still on sale with no end-of-sale notice [Fact]. But commercetools' 2026 launches leave it out: standalone Core Commerce and Product Catalog modules that "integrate with existing technology investments", and "commercetools for Builders", where Claude Code, Cursor and v0 generate storefronts from B2C shops to B2B ordering portals ([modular release](https://commercetools.com/press-releases/commercetools-launches-modular-commerce-offerings); [Builders release](https://commercetools.com/press-releases/commercetools-reduces-enterprise-commerce-delivery)). I read this as Frontend being deprioritized rather than retired, with commercetools itself now promoting the bring-your-own-frontend model [Estimate].

## Checkout keeps shipping features but has almost no public customers

commercetools Checkout launched on 9 May 2023 and reached general availability (GA) on 16 October 2023 [Fact] ([release](https://commercetools.com/press-releases/commercetools-unveils-checkout-solution-turning-expanded-touchpoints-into-sales); [GA note](https://docs.commercetools.com/checkout/releases/2023-10-16-commercetools-checkout-achieved-general-availability-status)). Investment has continued since: AWS regions (March 2026), Payment Intents and Drop-in GA (January 2026), and a Recurring Orders beta (October 2026) [Fact] ([Checkout releases](https://docs.commercetools.com/checkout/releases)).

Adoption evidence is thin. Three and a half years after launch, the only named customer tied to the product is an **APG & Co testimonial on the Checkout page**, and that page does not say which mode APG & Co uses [Fact] ([B2C Checkout](https://commercetools.com/products/b2c/checkout)). The checkout stories commercetools does tell describe custom flows. Breville mixes subscriptions and one-time items in one checkout, and Christie Cookie Co. ships to up to 500 addresses, which goes beyond what Complete Checkout lets you configure ([commercetools blog](https://commercetools.com/blog/commerce-capabilities-101-checkout)). Checkout is also a separately licensed add-on with no public price [Fact] ([overview](https://docs.commercetools.com/checkout/overview)). Most large brands went live between 2018 and 2022, before Checkout existed.

GitHub points the same way. Adyen's direct integration, which works with any custom checkout, is the oldest and most-starred option at 56 stars. commercetools' own Checkout connectors have 0 to 3 stars each [Fact] ([Adyen integration](https://github.com/Adyen/adyen-commercetools)). Stripe hedges by maintaining both a Connect app for any checkout and a separate Checkout app ([Stripe Connect app](https://github.com/stripe/stripe-commercetools-connect-app)).

My estimate is that Checkout runs in a smaller share of projects than Frontend, and that much of that use is Payment Only mode under a custom checkout UI. That blurs the "Checkout versus custom" split [Estimate].

## Both products leave B2B buyers to custom code

| | commercetools Frontend | commercetools Checkout |
|---|---|---|
| Public customer count | None [Fact] | None [Fact] |
| Named users | About 10, mid-market [Fact] | 1 (APG & Co) [Fact] |
| Estimated share of customers | Under 20% [Estimate] | Smaller than Frontend; mostly Payment Only [Estimate] |
| Vendor momentum | Left out of 2026 launches [Fact] | Steady 2026 releases [Fact] |
| B2B coverage | Paid B2B launchpad [Fact] | Invoice and PO only in a test sample connector; no business unit, approval or quote support in the docs [Fact] |

The two products are on opposite paths. Frontend competes with commercetools' own AI-builder story. Checkout is becoming the default payment layer that commercetools steers integrations toward: it deprecated Frontend's built-in Adyen integration in favour of connectors ([release note](https://docs.commercetools.com/frontend-development/releases/2024-08-02-deprecation-of-adyen-integration)).

For B2B, Checkout covers card payments and little else. In the docs, invoice and purchase order (PO) exist only in a sample connector meant for proofs of concept, and Payment Only mode has no address, shipping or discount code handling [Fact] ([connectors](https://docs.commercetools.com/checkout/connectors-and-applications)). So Forgeline's split matches how the market actually works: invoice plus PO for business buyers, and Checkout Payment Only by card for consumers and guests [Estimate].

## Nobody fills the free B2B storefront slot, but AI tools are a substitute

**commercetools has no maintained, permissively licensed storefront you can deploy** [Fact].

| Option | Status [Fact] | Source |
|---|---|---|
| Sunrise Java | Archived in 2019 | [GitHub](https://github.com/commercetools/commercetools-sunrise-java) |
| sunrise-spa | Dormant since July 2024 | [GitHub](https://github.com/commercetools/sunrise-spa) |
| Official B2B launchpad (`scaffold-b2b`) | Ships with paid Frontend; public repo has no license and 4 stars | [GitHub](https://github.com/FrontasticGmbH/scaffold-b2b) |
| Alokai's commercetools integration | Enterprise-only | [Alokai](https://docs.alokai.com/integrations/commercetools) |
| Vercel Next.js Commerce | Archived; never supported commercetools | [GitHub](https://github.com/vercel/commerce) |
| Repos matching "commercetools b2b" on GitHub | 5 repos, none with more than 1 star | [GitHub search](https://github.com/search?q=commercetools+storefront&type=repositories) |

Demand comes from the supply side. At least nine partners sell commercetools B2B accelerators, and in May 2026 commercetools certified Orium's as the first in a new accelerator program [Fact] ([Shopifreaks](https://www.shopifreaks.com/commercetools-launches-accelerator-certification-program-with-oriums-b2b-manufacturing-accelerator-as-first-certified/)). Grassroots developer demand is thin. StackOverflow has 83 commercetools questions, the latest from August 2024 [Fact] ([StackOverflow](https://stackoverflow.com/questions/tagged/commercetools)).

The real competitor is commercetools' `commercetools-storefront` AI skill. It is licensed CC-BY-4.0 and covers business units, quotes, approvals and purchase lists, but as patterns rather than a running app [Fact] ([skill docs](https://docs.commercetools.com/dev-tooling/skills/commercetools-storefront)).

Benchmarks keep expectations modest. Vendor-backed starters on other platforms reach hundreds to low thousands of stars, and vendors archive them within one to two years (Medusa's starters were replaced in 2026, and Vercel archived Next.js Commerce) [Fact] ([Medusa B2B starter](https://github.com/medusajs/b2b-starter)). A starter for a closed enterprise platform from an independent author realistically reaches tens to low hundreds of stars [Estimate].

Forgeline itself was created on 2026-10-25 and has 1 star. GitHub detects **no license**, so default copyright applies and agencies cannot legally reuse it yet [Fact] ([GitHub](https://github.com/sohelrana09/forgeline-storefront)).

## Conclusion

**Go, with conditions.** The market for Forgeline is real but narrow. The buyers are agencies and system integrators without their own accelerator, plus merchants evaluating commercetools B2B who want a working reference before paying for Frontend or a partner accelerator [Estimate]. It is not a product market. Expect a handful of serious users and consulting leads rather than broad open-source adoption.

Continue only on these conditions:

1. **Add an MIT or Apache-2.0 license this week.** Without one, the project has no market at all.
2. **Commit to visible maintenance.** Track Next.js and SDK releases on a cadence. Most competing starters die within two years, so steady upkeep is itself a selling point.
3. **Set kill criteria.** Stop investing beyond upkeep if, within about six months, there is no inbound agency or merchant interest, or if commercetools publishes a permissively licensed B2B app.

If you continue, focus on four things:

1. **B2B depth that Checkout and the AI skill lack.** Invoice and PO, approvals, quotes and company administration are your edge.
2. **A pluggable payment layer.** Keep Checkout Payment Only, and add a direct PSP adapter such as Adyen or a Stripe Connect app, because most customers do not license Checkout. Also verify that Checkout supports AWS us-east-2.
3. **One-command setup on the public B2B sample data, with end-to-end tests.** Proven, working flows are what an AI-generated storefront cannot offer.
4. **Positioning as the tested base that Claude Code and the commercetools storefront skill extend, not a rival to them.** commercetools is pushing teams toward AI-built frontends, and a verified starting point is what those teams lack.
