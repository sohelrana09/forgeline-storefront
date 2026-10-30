## What changed

<!-- What does this pull request do, and why? Link the issue if there is one: "Closes #..." -->

## How I tested it

<!-- Which pages or flows you tried, and as whom (guest, consumer, buyer, approver, company admin). -->

## Checklist

- [ ] `npm run typecheck`, `npm run lint`, `npm run format:check` and `npm test` pass
- [ ] `npm run test:e2e` passes, for changes a visitor sees
- [ ] New pure logic has unit tests next to it
- [ ] No secrets or admin client in client components; new `actions.ts` exports are meant to be public endpoints
- [ ] Browser tests that change data put it back
- [ ] README or CHANGELOG updated, if behaviour or setup changed
