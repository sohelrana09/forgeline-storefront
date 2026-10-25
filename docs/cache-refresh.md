# Refreshing the cached guest pages

Guests get the home, category, product and content pages from a cache (`src/app/(cached)/g`, see E17 in `docs/decomposition.md`). Without a refresh, a change reaches guests within 5 minutes. `POST /api/revalidate` refreshes them straight away. It marks every cached guest page stale, so each one re-renders on its next visit, and it clears the in-process data memos so that re-render reads fresh data. Signed-in pages render per request and need nothing.

## Who may call it

| Caller | How it authenticates |
|---|---|
| `npm run ct:content`, jobs, the queue for price changes | `Authorization: Bearer <REVALIDATE_SECRET>` |
| Merchant Center Content app | Merchant Center's `/proxy/forward-to` signs a 60-second token for the signed-in user. The storefront checks it against the Merchant Center API's public keys (issuer, audience = `<SITE_URL>/api/revalidate`, project `ctwara`). The app holds no secret. |

Anything else gets 401. Failed attempts are throttled per client address. The Merchant Center key set is cached for an hour; a token with an unknown key id reloads it at most once a minute (3 s timeout), so made-up tokens can't make the storefront hammer the Merchant Center API.

Body (optional): `{ "scope": "content" | "catalog" | "all" }`, or a commercetools Subscription payload (plain, wrapped in EventBridge's `detail`, or a Pub/Sub push `message.data`). Custom Objects mean content; anything else means catalog. All cached pages are purged either way; the scope only picks which memos to clear.

## Setup

1. **Secret.** Put `REVALIDATE_SECRET` in `.env` (and in the hosting environment). Use at least 32 random characters, for example from `openssl rand -hex 32`. Without it, secret callers are refused.
2. **Content from git (`npm run ct:content`).** Nothing else to do. After it writes or deletes something, it calls `SITE_URL/api/revalidate`. A failure only prints a warning, because the content is already saved.
3. **Merchant Center Content app.** Build it with `STOREFRONT_URL=https://<public storefront>` (`additionalEnv.storefrontUrl` in `cms-app/custom-application-config.mjs`). After each save or delete, it calls the storefront through `/proxy/forward-to`. The Merchant Center API makes that request, so the storefront must be **publicly reachable**. `http://localhost:3000` only works through a tunnel (for example `cloudflared tunnel --url http://localhost:3000`, with `STOREFRONT_URL` and `SITE_URL` both set to the tunnel URL).
4. **Prices, products, discounts, categories (Merchant Center or imports).** commercetools Subscriptions deliver to a queue, not to a URL. Use AWS EventBridge, whose API destinations can POST to us with the secret:
   1. `npm run ct:catalog-subscription -- --eventbridge <aws-account-id>` shows what it will do. Add `--yes` to create the `storefront-cache-refresh` Subscription. It covers changes to standalone prices, products, product discounts, categories and Custom Objects.
   2. AWS console, region **us-east-2**: EventBridge → Partner event sources. Associate the new commercetools source with an event bus. This must happen soon after step 1, or the source expires.
   3. EventBridge → API destinations → create a connection with **API key** authorization: header `Authorization`, value `Bearer <REVALIDATE_SECRET>`. Then create an API destination: `POST https://<public storefront>/api/revalidate`, with a rate limit of a few calls per second.
   4. Create a rule on that event bus with the pattern `{ "source": [{ "prefix": "aws.partner/commercetools.com" }] }` and the API destination as target.

   Google Pub/Sub (`--pubsub <project>/<topic>`) also works for the Subscription, but Pub/Sub push can't send our `Authorization` header. It needs a small relay (for example a Cloud Function) that adds the header.

## Limits

- One purge drops all ~120 cached pages. Calls within 10 seconds of the last purge are folded into it (answer `"reason": "coalesced"`), so an import's hundreds of events cause one purge every 10 s at most. A change that arrives in such a window still shows at the next 5-minute regeneration at the latest.
- The memos are per process. On several instances, only the one that received the call clears them; the others catch up within their own refresh time (1 to 5 minutes).
- Product edits that are only staged (not published) also trigger a purge. Harmless, just unnecessary.
