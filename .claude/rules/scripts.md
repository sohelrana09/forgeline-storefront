---
paths:
  - "scripts/**"
---

# Script conventions

- Every script must be **idempotent**: look up by key or email first, then create only if it's missing. Re-running a script must not fail with `DuplicateField`.
- Read arguments from `process.argv.slice(2)` and give defaults that work against the sample data.
- End scripts with `main().catch(err => { console.error(err?.body ?? err); process.exit(1); })`.
- Register each new script in `package.json` as `ct:<name>` using `tsx --env-file=.env`.
- Scripts that **write** data should print what they changed, so the output can be checked against Merchant Center.
