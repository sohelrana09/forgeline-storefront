# Refreshing the cached data

Every catalog, content and blog page is a prerendered shell built from cached reads (`"use cache"`, `src/lib/cache.ts`), for guests and signed-in visitors alike. Without a refresh, a change shows when the read's lifetime runs out: 15 minutes for prices, products and the URL index, an hour for categories and business units, a minute for Sanity content. `POST /api/revalidate` refreshes them straight away: it expires the cache tags of what changed (`revalidateTag`), so the next visit reads fresh data and the shells built from it are rebuilt.

## Who may call it

| Caller | How it authenticates |
|---|---|
| Jobs, the queue for price changes | `Authorization: Bearer <REVALIDATE_SECRET>` |
| Sanity publish webhook | `Authorization: Bearer <REVALIDATE_SECRET>` (a header set in the webhook) |

Anything else gets 401. Failed attempts are throttled per client address.

Body (optional): `{ "scope": "content" | "catalog" | "all" }`, or a commercetools Subscription payload (plain, wrapped in EventBridge's `detail`, or a Pub/Sub push `message.data`). Custom Objects mean content; anything else means catalog. All cached pages are purged either way; the scope only picks which memos to clear.

## Setup

1. **Secret.** Put `REVALIDATE_SECRET` in `.env` (and in the hosting environment). Use at least 32 random characters, for example from `openssl rand -hex 32`. Without it, secret callers are refused.
2. **Pages, blocks and blog (Sanity).** `npm run ct:sanity-webhook` prints a link to Sanity's "create webhook" form, already filled in: `POST <SITE_URL>/api/revalidate`, body `{"scope": "content"}` (projection), filter `_type in ["page", "cmsBlock", "post", "author", "blogCategory"]`, on create, update and delete, no drafts. In the form, add the header `Authorization: Bearer <REVALIDATE_SECRET>` (the secret is left out of the link on purpose), then save. Publish something in `/studio`; the webhook's attempt log should show `200 {"revalidated":true}`. Without the webhook, Sanity changes show within a minute (the content lifetime); new or renamed pages reach the URL index within 15 minutes.
3. **Optional: prices, products, discounts, categories (Merchant Center or imports).** Not needed: without it these changes show within 15 minutes (the price lifetime), or at once after `npm run ct:revalidate -- --scope catalog`. For automatic refreshes you need a queue service, because commercetools Subscriptions deliver to a queue, not to a URL. With AWS EventBridge, whose API destinations can POST to us with the secret:
   1. `npm run ct:catalog-subscription -- --eventbridge <aws-account-id>` shows what it will do. Add `--yes` to create the `storefront-cache-refresh` Subscription. It covers changes to standalone prices, products, product discounts, categories and Custom Objects.
   2. AWS console, in your commercetools project's region (for example **us-east-2**): EventBridge → Partner event sources. Associate the new commercetools source with an event bus. This must happen soon after step 1, or the source expires.
   3. EventBridge → API destinations → create a connection with **API key** authorization: header `Authorization`, value `Bearer <REVALIDATE_SECRET>`. Then create an API destination: `POST https://<public storefront>/api/revalidate`, with a rate limit of a few calls per second.
   4. Create a rule on that event bus with the pattern `{ "source": [{ "prefix": "aws.partner/commercetools.com" }] }` and the API destination as target.

   Google Pub/Sub (`--pubsub <project>/<topic>`) also works for the Subscription, but Pub/Sub push can't send our `Authorization` header. It needs a small relay (for example a Cloud Function) that adds the header.

## Limits

- Every call is applied: it only expires cache tags, so the affected reads (and the shells built from them) reload once, on their next use. An import's hundreds of events cost hundreds of cheap tag updates, not page renders. (Calls used to be folded into one per 10 seconds, which left a change arriving inside that window stale for the read's whole lifetime.)
- `"use cache: remote"` entries are shared between instances on Vercel, so one call refreshes all of them. The search index is still a per-process memo: instances that didn't receive the call rebuild it within 5 minutes. The proxy's copy of the URL index (redirects) refreshes every minute per process.
- Product edits that are only staged (not published) also trigger a purge. Harmless, just unnecessary.

## Checking it by hand

`npm run ct:revalidate -- --url <site> --scope catalog` calls the route with `REVALIDATE_SECRET` from `.env` (the value must match the deployment's). To see a refresh end to end: `npm run ct:price -- fuel-filter-2` shows the guest Fuel Filter price, `-- fuel-filter-2 3260 --yes` changes it (the page keeps the cached price), `ct:revalidate` makes the new one show on the next visit, and `-- fuel-filter-2 3250 --yes` plus another `ct:revalidate` puts it back.
