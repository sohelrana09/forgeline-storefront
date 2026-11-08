# Troubleshooting

| Symptom | Cause and fix |
|---|---|
| `next build` fails asking for `SITE_URL` | Set `SITE_URL` to the public address (locally `http://localhost:3000`) |
| Production server refuses to start | `SESSION_SECRET` is missing; set at least 32 random characters |
| 403 `insufficient_scope` in the logs | The runtime client lacks the named scope. Scopes can't be added to a client: create a new one and swap the ID and secret. `npm run setup -- --check` lists what's missing |
| Signed-in buyers see no company or account pages fail | The runtime client needs **Manage** business units, or the unit's store is missing from `STORE_PRICING` |
| Products show no price | The store's channel has no standalone price in that currency and country; check `STORE_PRICING` and `npm run ct:contexts` |
| Sign-in fails for a store's buyers | The storefront client lacks the per-store scopes for that store |
| 400 `SearchDeactivated` or 404 from search | Search APIs are off in a new project; the built-in in-memory search is used. Activate Product Search before setting `CATALOG_SEARCH=product-search` |
| Price or product change doesn't show | Cached up to 15 minutes. Run `npm run ct:revalidate -- --url <site> --scope catalog` |
| Payment step says ordering isn't available | No payment switch is on; see [Commercetools Configuration](Commercetools-Configuration), section 6 |
| No emails arrive | Set `RESEND_API_KEY` and `MAIL_FROM`; in development they are printed to the server log |
| Images stop loading on Vercel | Image optimizer quota; set `IMAGES_UNOPTIMIZED=true` and redeploy |
| Pages are slow from your laptop | commercetools is a few hundred ms away outside its region; on Vercel in the matching region it is a few ms |
| Client components stop working after moving files | Stale cache: stop the dev server, `rm -rf .next`, start again |
| Site not in Google | `SITE_INDEXABLE=true` is needed (build time), then redeploy |
