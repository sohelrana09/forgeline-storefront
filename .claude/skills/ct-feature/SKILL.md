---
name: ct-feature
description: End-to-end workflow for building a storefront feature from docs/decomposition.md, covering plan, data check, implement, verify, and review. Use when the user asks to build or continue a feature such as quick order, company switcher, quotes, approvals, cart, or checkout.
---

# Build a feature

Follow these phases in order. Keep the task list current.

## 1. Pick and decompose
- Find the epic in `docs/decomposition.md`. If it has no task breakdown yet, or the feature is new, delegate to the **b2b-architect** subagent and paste its plan into the doc.
- Choose the next task whose dependencies are done.

## 2. Check data
- Use the **ct-data-explorer** subagent or the `ct-query` skill to confirm the resources this task relies on exist and look as expected (for example, roles have the permission, stores have channels, prices exist in the currency).
- If data is missing, add an idempotent script in `scripts/` first.

## 3. Implement
- Follow `.claude/rules/` (they load automatically for matching paths).
- Keep each task to one focused change. Don't start the next task in the same pass.

## 4. Verify
- `npm run typecheck && npm run lint`
- For UI: load the page in the browser preview (dev server on :3000) and check the acceptance criterion on screen.
- For scripts: run them twice. The second run must succeed without changing anything (idempotency).

## 5. Review and record
- Run the **ct-code-reviewer** subagent on the diff and fix its findings.
- Mark the task done in `docs/decomposition.md` with a one-line note of anything surprising.
- **Do not commit.** The user commits manually.
