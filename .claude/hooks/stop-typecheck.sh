#!/usr/bin/env bash
# Stop: if TS files changed, require a clean typecheck before Claude finishes.
input=$(cat)
[[ "$(jq -r '.stop_hook_active // false' <<<"$input")" == "true" ]] && exit 0   # avoid infinite loops
cd "$CLAUDE_PROJECT_DIR" || exit 0
git status --porcelain -- '*.ts' '*.tsx' '*.mts' | grep -q . || exit 0
if ! out=$(npx --no-install tsc --noEmit 2>&1); then
  echo "Typecheck failed. Fix these before finishing:" >&2
  echo "$out" | head -40 >&2
  exit 2
fi
exit 0
