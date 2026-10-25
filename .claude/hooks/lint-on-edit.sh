#!/usr/bin/env bash
# PostToolUse (Edit|Write): eslint --fix the edited TS file; feed remaining errors back to Claude.
f=$(jq -r '.tool_response.filePath // .tool_input.file_path // ""')
[[ "$f" =~ \.(ts|tsx|mts)$ && -f "$f" ]] || exit 0
cd "$CLAUDE_PROJECT_DIR" || exit 0
if ! out=$(npx --no-install eslint --fix "$f" 2>&1); then
  echo "eslint found problems in $f:" >&2
  echo "$out" >&2
  exit 2
fi
exit 0
