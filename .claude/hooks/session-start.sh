#!/usr/bin/env bash
# SessionStart: stdout is added to Claude's context.
cd "$CLAUDE_PROJECT_DIR" || exit 0
echo "Branch: $(git branch --show-current)"
echo "Uncommitted changes (user commits manually, never commit for them):"
git status --short | head -30
