# Contributing to Forgeline

Bug fixes, new B2B or B2C workflows and better documentation are all welcome. For larger changes, open an issue first so we can agree on the approach.

## Getting set up

Follow the [Quick start](README.md#quick-start): you need Node.js and a commercetools project with the B2B sample data. `npm run setup` does the rest.

## Making a change

1. Fork the repository and create a branch: `git checkout -b feature/your-change`.
2. Follow the [project structure](README.md#project-structure):
   - pages in `src/app` stay thin and only route;
   - Server Actions go in `src/features/<x>/actions.ts`, and only entry points: every export of a `"use server"` file is a public endpoint;
   - commercetools calls and business logic go in `service.ts`;
   - pure logic goes in small modules with unit tests next to them (`*.test.ts`).
3. Keep secrets on the server: the admin API client is server-only, and customers use their own narrowed token.
4. Run the checks:

   ```bash
   npm run typecheck
   npm run lint
   npm run format:check
   npm test
   ```

   Plus `npm run test:e2e` for anything a visitor sees.

5. Commit, push the branch and open a pull request that says what changed and how you tested it.

## Browser tests

Guest tests stay read-only. Tests that sign in or change data must put back what they create, even when a step fails, because they run against a shared commercetools project.

## Reporting bugs and security issues

- Bugs and ideas: [open an issue](https://github.com/sohelrana09/forgeline-storefront/issues/new/choose).
- Security problems: report them privately, see [SECURITY.md](SECURITY.md).

By contributing you agree to follow the [code of conduct](CODE_OF_CONDUCT.md), and that your contribution is licensed under the [MIT License](LICENSE).
