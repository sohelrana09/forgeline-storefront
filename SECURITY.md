# Security policy

## Supported versions

Security fixes go into the latest release and `main`. Older releases don't get patches: update to the latest version.

## Reporting a vulnerability

Please **don't open a public issue** for a security problem.

Report it privately through GitHub instead: [Report a vulnerability](https://github.com/sohelrana09/forgeline-storefront/security/advisories/new) (Security tab → Advisories → Report a vulnerability).

Include what you can of:

- what is affected (a route, a Server Action, a script) and what an attacker could do with it;
- the steps to reproduce it, or a proof of concept;
- the version or commit you tested.

You'll get an answer within 7 days. Once a fix is released, the advisory is published and you're credited, unless you'd rather not be.

## Scope

In scope: the code in this repository, for example session handling, customer token scopes, permission checks for company data, the Content-Security-Policy, Server Actions and Route Handlers.

Out of scope:

- the public demo's data (it is a shared sample project, and guest carts are expected to be created there);
- vulnerabilities in commercetools, Sanity, Vercel or other services themselves: report those to the vendor;
- findings that need a leaked `.env` or admin API credentials;
- missing hardening headers or rate limits without a concrete attack.

Please don't run automated scanners or load tests against the live demo.
