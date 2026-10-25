---
paths:
  - "src/**/*.{ts,tsx}"
  - "scripts/**/*.{ts,mts}"
---

# commercetools API conventions

- Always go through `apiRoot` (admin) or `customerApiRoot(token)` (signed-in customer) from `@/lib/commercetools`. Never create a `ClientBuilder` anywhere else. Customer-scoped writes (carts, quotes, orders) use `customerApiRoot` so commercetools checks the associate's permissions.
- **Optimistic concurrency:** every update needs the resource's current `version`. If you get a `409 ConcurrentModification`, re-fetch the resource, re-apply the change, and retry once. Never hard-code versions.
- Batch related changes into one update with multiple `actions` rather than making several update calls.
- Prefer `key` over `id` in code and scripts, for example `.withKey({ key })` and references like `{ typeId: "associate-role", key }`. Keys are stable across projects; ids are not.
- **Prices:** read `variant.price` from a price-selected `productProjections()` query. Never use `variant.prices[0]`, because prices are standalone and that array is empty.
- **Money:** always format from `centAmount / 10 ** fractionDigits` with `Intl.NumberFormat`. Never assume 2 decimals.
- Localized fields (`name`, `description`, `slug`) are `LocalizedString` maps. Choose the locale explicitly, falling back to the first value.
- Query predicates (`where`) are strings. Quote string values (`email="a@b.c"`) and never interpolate unescaped user input.
- Surface SDK errors with `err.body` (it contains `statusCode`, `message`, and `errors[].code`), not the raw error object.
