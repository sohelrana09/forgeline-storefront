#!/usr/bin/env bash
# PreToolUse (Read|Edit|Write|Bash): block access to .env (secrets). .env.example is allowed.
input=$(cat)
tool=$(jq -r '.tool_name' <<<"$input")

if [[ "$tool" == "Bash" ]]; then
  cmd=$(jq -r '.tool_input.command // ""' <<<"$input")
  # npm scripts load it via `tsx --env-file=.env`; that's fine, the values never reach the transcript.
  stripped=${cmd//--env-file=.env/}
  if grep -Eq "(^|[[:space:]/'\"<=])\.env([[:space:]'\";|&>)]|$)" <<<"$stripped"; then
    echo "Blocked: this command touches .env, which holds commercetools API secrets. Use .env.example for the shape, or ask the user." >&2
    exit 2
  fi
else
  path=$(jq -r '.tool_input.file_path // ""' <<<"$input")
  if [[ "$(basename "$path")" == ".env" ]]; then
    echo "Blocked: .env holds commercetools API secrets and must not be read or edited by Claude. Use .env.example instead." >&2
    exit 2
  fi
fi
exit 0
