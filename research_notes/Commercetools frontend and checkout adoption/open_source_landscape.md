# Open-source and starter storefront landscape for commercetools, and demand for an open-source B2B storefront

All GitHub numbers below were read live from the GitHub API on 2026-10-30 (stars / forks / last push / archived / license). npm numbers are npm's own download API for 2026-09-29 to 2026-10-28. "Fact" = read from a primary source. "Estimate/inference" is marked as such.

## 1. commercetools' own storefronts and samples: open source, maintained, archived?

### Takeaway
commercetools has no maintained, permissively licensed, deployable storefront on GitHub as of 2026-10-30. Sunrise Java is archived (last push 2019) and sunrise-spa is dormant (last push 2024-07). The official B2B storefront, the Store Launchpad for B2B Manufacturing, ships inside the paid commercetools Frontend product. Its scaffold repo is public but has no license and 4 stars. From mid-2026 commercetools' newest answer is AI-generated storefronts: a Next.js 16 "storefront skill" with B2B patterns (CC-BY-4.0 guidance, not a running app).

### Cited Findings
- **Sunrise Java (Play):** `commercetools/commercetools-sunrise-java`: 49 stars, 31 forks, last push 2019-10-15, **archived**, Apache-2.0 (fact). [GitHub](https://github.com/commercetools/commercetools-sunrise-java)
- **Sunrise SPA (Vue):** `commercetools/sunrise-spa`: 51 stars, 75 forks, last push 2024-07-16, not archived but dormant for over 2 years, Apache-2.0 (fact). [GitHub](https://github.com/commercetools/sunrise-spa)
- `commercetools/commercetools-sunrise-theme`: 13 stars, archived, last push 2025-03-09. `commercetools/commercetools-sunrise-data` (sample data, still used): 43 stars, 71 forks, last push 2026-02-19, Apache-2.0 (fact). [GitHub](https://github.com/commercetools/commercetools-sunrise-data)
- Other small commercetools repos: `cofe-ct-b2b-ecommerce` (2 stars, last push 2024-03), `cofe-ct-graphql-b2b-ecommerce` (0 stars, last push 2026-03), `standlone-variants-storefront` (2 stars, archived), `hackathon-starter-kit` (1 star, MIT, created 2025-09, "templates, checkout flows, MCP configs") (fact). [GitHub org](https://github.com/commercetools); [hackathon-starter-kit](https://github.com/commercetools/hackathon-starter-kit)
- `commercetools/commercetools-demo`, `commercetools-b2b-sample-data` and `nextjs-commercetools-starter` do not exist under those names (GitHub API 404, 2026-10-30).
- **Store Launchpad for B2B Manufacturing** (formerly "B2B store template", introduced 2023-11-03): "Your commercetools Frontend project comes with a Store Launchpad for B2B Manufacturing". Features: quotes, quote renegotiation, approval rules, approval flows, business unit and store selector, company admin, purchase lists, quick order, orders (fact). [Docs overview](https://docs.commercetools.com/frontend-development/b2b-store-launchpad-overview); [Release 2023-11-03](https://docs.commercetools.com/frontend-development/releases/2023-11-03-introduced-the-commercetools-frontend-b2b-store-template)
- Its code lives at `FrontasticGmbH/scaffold-b2b`: public, **no license file**, 4 stars, 0 forks, last push 2026-07-01. `scaffold-b2c`: 14 stars, no license, last push 2026-01-14 (fact). [scaffold-b2b](https://github.com/FrontasticGmbH/scaffold-b2b); [scaffold-b2c](https://github.com/FrontasticGmbH/scaffold-b2c)
- 2025-07-22: commercetools deprecated and replaced the public Store Launchpad repositories. The split libraries (`components-b2b`, `extension-commercetools-b2b`, `types-b2b`, `extension-commercetools` with 9 stars, `components` with 13 stars) were archived on 2025-07-15 (fact). [Release note](https://docs.commercetools.com/frontend-development/releases/2025-07-22-deprecated-and-replaced-store-launchpad-repositories); [FrontasticGmbH org](https://github.com/FrontasticGmbH)
- 2026-01-20: an official Figma design system and UI kit for the B2B Manufacturing launchpad, covering bulk ordering, quotes and approval flows (fact). [Release note](https://docs.commercetools.com/frontend-development/releases/2026-01-20-introduced-the-official-figma-design-system-and-ui-kit-for-the-store-launchpad-for-b2b-manufacturing)
- commercetools Frontend is described as a frontend-as-a-service product (Studio, API hub, Netlify-based hosting). It is a separate commercial offering (fact). [Product description](https://docs.commercetools.com/offering/frontend)
- `@commercetools/frontend-sdk`: 14,475 npm downloads per month, against 639,390 for `@commercetools/platform-sdk` and 634,554 for `@commercetools/ts-client` (fact). [npm API](https://api.npmjs.org/downloads/point/last-month/@commercetools/frontend-sdk)
- **AI route (2026):** `commercetools/commercetools-ai-plugins` was created 2026-05-27: 6 stars, last push 2026-10-28, **CC-BY-4.0**. Its `commercetools-storefront` skill covers "the full B2C and B2B domain feature set" (business unit and store selection, as-associate carts, quotes, quote actions, approval workflows, RBAC permissions, purchase lists). It holds patterns and code, not a deployable app (fact). [Repo](https://github.com/commercetools/commercetools-ai-plugins); [Skill docs](https://docs.commercetools.com/dev-tooling/skills/commercetools-storefront); [AI plugin release 2026-06-24](https://docs.commercetools.com/docs/releases/2026-06-24-introduced-an-ai-plugin-for-building-on-commercetools-with-your-agent)
- "commercetools for Builders" (blog post 2026-07-15): self-serve free trial plus "Build with AI", which generates a Next.js storefront with the storefront skill. The example is B2C, and B2B Commerce is listed as a separate product (fact). [Blog](https://commercetools.com/blog/build-a-storefront-in-your-lunch-break-with-commercetools); [Build from scratch tutorial](https://docs.commercetools.com/dev-tooling/build-with-ai-storefront-from-scratch)
- commercetools ran a "Starters team" job ad (Senior Front End Engineer, posted "6+ months ago", now closed). It builds "fully functional e-commerce Next.js-based web stores" as a reference that customers modify (fact; exact post date unknown). [Job post](https://jobs.accel.com/companies/commercetools/jobs/36505974-senior-front-end-engineer-starters-team-m-f-x)

### Inferences
- The free, permissive, runnable B2B storefront slot for commercetools appears to be **empty**. The official B2B reference is licensed through Frontend and unlicensed on GitHub. Sunrise is dead. The AI skill is guidance, not an app.
- The biggest substitute risk for Forgeline is commercetools' own AI path: an agent plus the storefront skill now produces B2B code on request. Forgeline's edge has to be a tested, working, end-to-end app, not the patterns alone (inference).
- Low Frontend SDK downloads (about 2% of platform-sdk) suggest most commercetools projects build custom frontends rather than use commercetools Frontend. That is the pool an open-source starter would serve (estimate; download counts include CI and are a rough proxy).

### Gaps
- The scaffold-b2b terms of use for non-Frontend customers were not found. With no license file, default copyright applies.
- Whether the launchpads still use Next.js, and which version, was not checked.

## 2. Third-party: Alokai, Vercel Next.js Commerce, agency starters, accelerators

### Takeaway
The main third-party open-source options have closed or moved away from commercetools. Alokai's commercetools integration is Enterprise-only, and in 2024 Alokai stopped publishing its public boilerplates. Vercel's Next.js Commerce was archived in 2026 and never listed commercetools. Agencies sell commercetools B2B accelerators commercially (Orium, O2, EPAM, Object Edge, Deloitte, valantic, mindcurv). No agency open-source commercetools storefront with traction was found.

### Cited Findings
- **Alokai (formerly Vue Storefront):** `vuestorefront/vue-storefront` has 10,960 stars, 2,061 forks, last push 2026-06-09, and no detected license. The README claims "3500+ Live Stores" (fact for the repo numbers, vendor claim for the store count). [GitHub](https://github.com/vuestorefront/vue-storefront)
- Alokai's commercetools integration is "only available as part of our Enterprise offering" (contact sales) (fact, read 2026-10-30). [Alokai docs](https://docs.alokai.com/integrations/commercetools)
- 2024-09-02: Alokai moved Middleware and SDK from MIT to BSD-3, and its Next.js and Nuxt boilerplates were "no longer publicly available" (fact). [Alokai news](https://alokai.com/news/alokai-licensing-and-open-source-changes); [Open source vs Enterprise](https://alokai.com/blog/alokai-open-source-vs-alokai-enterprise)
- `vuestorefront/storefront-ui` (UI library): 2,806 stars, MIT, last push 2026-10-21 (fact). [GitHub](https://github.com/vuestorefront/storefront-ui)
- **Vercel Next.js Commerce:** `vercel/commerce` has 14,311 stars and 5,467 forks and is **archived** (last push 2026-10-19). README: "This repository is archived and the template is deprecated. Development has moved to vercel/shop", which is Shopify only. Its provider list (BigCommerce, Medusa, Saleor, Shopware, Swell, Wix and others) never included commercetools (fact). [GitHub](https://github.com/vercel/commerce). `vercel/shop`: 115 stars, MIT, created 2026-03-09 (fact). [GitHub](https://github.com/vercel/shop)
- GitHub search on 2026-10-30: "commercetools storefront" gives 26 repos and "commercetools nextjs" 10. Apart from vue-storefront, none has more than 4 stars (for example `iamfortune/Storyblok-Commercetools-React-Storefront` 4, `nivox/ct-storefront` 3, `thisisbhanuj/CommerceTools-NextJS-Template` 1). "commercetools b2b" gives 5 repos, all with 0 or 1 stars, Forgeline included (fact). [GitHub search](https://github.com/search?q=commercetools+storefront&type=repositories)
- Forgeline `sohelrana09/forgeline-storefront`: created 2026-10-25, 1 star, 1 fork, no license detected by GitHub (fact). [GitHub](https://github.com/sohelrana09/forgeline-storefront)
- **Lab Digital** publishes commercetools tooling, not storefronts: `terraform-provider-commercetools` (68 stars), `commercetools-go-sdk` (27), `commercetools-node-mock` (22), `commercetools-python-sdk` (17), all active in October 2026 (fact). No Lab Digital, Valtech or Orium open-source commercetools storefront was found. [labd on GitHub](https://github.com/labd)
- **Partner accelerators (commercial):** Orium B2B Accelerator (Next.js, business units, recurring orders, MCP/Agent Gateway compatible). On 2026-05-04 commercetools launched an accelerator certification program, and Orium's B2B Manufacturing accelerator was certified first. Others: O2 Web (Vue Storefront + Contentful + Akeneo + Bloomreach), Royal Cyber, mindcurv B2Xaccelerator, EPAM B2B Booster, Object Edge Launchpad, Deloitte Digital, valantic + Bloomreach (June 2024), BORN Adler (fact; licensing not stated on the pages, assumed commercial). [Orium listing](https://commercetools.com/technology-partners/oriums-b2b-commercetools-accelerator); [Certification news](https://www.shopifreaks.com/commercetools-launches-accelerator-certification-program-with-oriums-b2b-manufacturing-accelerator-as-first-certified/); [O2 accelerator](https://marketplace.commercetools.com/accelerators/o2s-b2b-commercetools-accelerator); [commercetools blog on B2B accelerators](https://commercetools.com/blog/how-b2b-accelerators-expedite-your-ecommerce-implementation); [EPAM](https://epam.com/services/partners/commercetools/commercetools-b2b-booster); [Object Edge](https://objectedge.com/accelerators/launchpad); [valantic/Bloomreach](https://www.destinationcrm.com/Articles/CRM-News/CRM-Across-the-Wire/Bloomreach-Partners-with-valantic-and-commercetools-to-Form-the-B2B-Accelerator-164399.aspx)

### Inferences
- At least 9 partners productise a commercetools B2B storefront, and commercetools now certifies them. That is strong evidence agencies want a B2B head start, and that they monetise it as consulting IP rather than open source (inference).
- An open-source, permissively licensed Forgeline would be the only free alternative. It may face resistance from agencies whose accelerators it undercuts, and interest from smaller agencies that have none (inference).

### Gaps
- Netlify, Uniform and Contentstack commercetools starters were not found in this pass. The `marcelfahle/commercetools-nextjs-netlify` (0 stars, 2023) and `agility/agility-commercetools-demo` (0 stars, 2025-12) repos exist but are trivial.
- Accelerator prices and licenses are not public.
- No Scayle/Spryker open-source storefront comparison was researched.

## 3. Benchmarks: open-source storefronts on other platforms

### Takeaway
Storefronts with traction are backed by a platform vendor and sit next to an open-source or free backend: Medusa, Saleor, Vendure, Hydrogen, Catalyst. Their stars are in the hundreds to low thousands, far below the platform repos. Vendors also keep replacing their starters, and B2B features are increasingly paid (Vendure tiers, Alokai Enterprise).

### Cited Findings (GitHub, 2026-10-30)
- **Medusa:** core `medusajs/medusa` 37,009 stars. `nextjs-starter-medusa` 2,785 stars / 998 forks, **archived** (last push 2026-04-23, README points to `dtc-starter`). `dtc-starter` 154 stars, MIT. `b2b-starter-medusa` 423 stars / 216 forks, **archived** 2026-04, replaced by `medusajs/b2b-starter`: 56 stars, MIT, created 2025-12-18, active. Medusa's B2B starter offers approval workflows. `@medusajs/js-sdk`: 966,537 npm downloads per month (fact). [nextjs-starter](https://github.com/medusajs/nextjs-starter-medusa); [b2b-starter](https://github.com/medusajs/b2b-starter); [old B2B starter](https://github.com/medusajs/b2b-starter-medusa)
- **Saleor:** core 23,490 stars, BSD-3. `saleor/storefront` 1,638 stars / 905 forks, active (2026-10-20) (fact). [GitHub](https://github.com/saleor/storefront)
- **Shopify Hydrogen:** 2,161 stars / 453 forks, MIT, active. `@shopify/hydrogen`: 328,961 npm downloads per month (fact). [GitHub](https://github.com/Shopify/hydrogen)
- **BigCommerce Catalyst:** 249 stars / 362 forks, MIT, active (2026-10-29) (fact). [GitHub](https://github.com/bigcommerce/catalyst)
- **Vendure:** core 8,551 stars. `nextjs-starter-vendure` ("Official Next.js 16 starter") 48 stars, MIT, created 2025-10. `storefront-remix-starter` 227 stars (fact). Vendure markets a B2B storefront (company accounts, quote-to-order, approvals, quick order, shopping lists, contract pricing) with features **gated by paid tiers**: "Quote requests from Starter, negotiation across versions on Enterprise"; approvals "from Scale" (fact, vendor page). [nextjs-starter-vendure](https://github.com/vendurehq/nextjs-starter-vendure); [Vendure storefront page](https://vendure.io/features/storefront)
- StackOverflow tag sizes (2026-10-30): commercetools 83 questions (latest 2024-08-01), saleor 112, shopify-hydrogen 53, medusajs 41, bigcommerce 1,667 (fact). [StackOverflow tag](https://stackoverflow.com/questions/tagged/commercetools)

### Inferences
- Realistic traction for a vendor-neutral starter on a closed enterprise platform is probably tens to low hundreds of stars. The commercetools developer audience is small and works mostly inside agencies, which matches the StackOverflow volume (estimate).
- The business models seen are paid feature tiers (Vendure), enterprise licences (Alokai), platform lock-in (Hydrogen, Catalyst, Medusa Cloud) and agency accelerators. For an independent author, consulting, implementation and paid support are the plausible routes (inference).
- Even big vendors archive starters within 1 to 2 years (Medusa twice in 2026, Vercel 2026). Steady maintenance is a differentiator in itself (inference).

### Gaps
- No reliable revenue figures for any storefront-template business were found.

## 4. Evidence of demand: community, accelerators, B2B as a growth area

### Takeaway
The strongest demand signal comes from the supply side. commercetools and at least 9 partners invest in B2B storefront accelerators, commercetools certified the first one in May 2026, and it keeps shipping B2B features. Grassroots developer demand is thin and hard to measure: no Reddit threads were found and StackOverflow activity is low. commercetools does not publish its share of B2B customers.

### Cited Findings
- commercetools passed $75B annualized GMV, with over 60% year-over-year growth (press release, September 2025), and serves "over 600 brands, retailers and B2B organizations" (fact, vendor claim). [Press release](https://commercetools.com/press-releases/commercetools-tops-75b-in-annualized-gmv)
- Cyber Week 2025: $4.5B GMV, up 48% year over year (fact, vendor claim). [Press release](https://commercetools.com/press-releases/commercetools-powers-record-cyber-week-performance-for-global-enterprises)
- B2B features: Spring 2025 Compilations added shareable B2B purchasing lists (fact). [Press release](https://commercetools.com/press-releases/commercetools-unveils-spring-2025-compilations-to-power-better-experiences-faster-growth-and-smarter-operations). The B2B launchpad Figma UI kit arrived 2026-01 (see section 1), and the storefront skill's B2B patterns 2026-05/06.
- In July 2025 commercetools won 16 gold medals in the Paradigm B2B Combine reports (fact). [Press release](https://commercetools.com/press-releases/commercetools-sweeps-2025-paradigm-b2b-combine-reports-with-16-gold-medals)
- commercetools has a dedicated industrials and manufacturing solution page. B2B examples: Coflex (B2B modernised in 90 days, 80% customer adoption) and Adelco (eCommerce sales up 400%) (fact, vendor case studies). [Industrials page](https://commercetools.com/solutions/for-industrials-manufacturing); [Customer stories](https://commercetools.com/blog/top-commercetools-customer-stories)
- The accelerator certification program (2026-05-04) plans more accelerators and industry use cases during the year (fact). [Shopifreaks](https://www.shopifreaks.com/commercetools-launches-accelerator-certification-program-with-oriums-b2b-manufacturing-accelerator-as-first-certified/)
- A search for Reddit threads asking for commercetools storefront starters returned none (finding of absence, 2026-10-30).

### Inferences
- B2B looks like a priority growth area for commercetools: dedicated launchpad, Figma kit, B2B APIs, certified B2B accelerators, B2B analyst awards. The size of the B2B share is unknown (inference).
- The likely buyers of something like Forgeline are agencies and system integrators without their own accelerator, plus merchants evaluating commercetools B2B who want a working reference before committing to Frontend or a paid accelerator. Self-serve "commercetools for Builders" (2026) may widen the funnel of smaller teams (inference).

### Gaps
- No commercetools figure for B2B customer or revenue share was found, and no third-party estimate either.
- The commercetools community forum and job boards were not quantified, for example counts of "commercetools Next.js" job posts.
- Hacker News discussions were not checked.
