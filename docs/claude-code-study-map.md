# Claude Code study map: this repo as a worked example

Each Claude Code building block, where it lives in this repo, and what you should be able to explain. Check it against the official exam guide and the Claude Code docs; this map covers the concepts, not the exam syllabus.

| Concept | In this repo | What it does here | Be able to explain |
|---|---|---|---|
| **Project memory** | `CLAUDE.md` | Commands, architecture, and the non-obvious facts (standalone prices, search deactivated) | Load order: managed → user (`~/.claude/CLAUDE.md`) → project → local; `@path` imports; what belongs in it (things that aren't discoverable) and what doesn't (generic advice, file listings) |
| **Rules (path-scoped memory)** | `.claude/rules/*.md` with `paths:` frontmatter | API conventions load only when Claude works on `src/**` or `scripts/**` | Why scope rules by path (saves context, fewer conflicts); rules with no `paths:` always load |
| **Subagents** | `.claude/agents/*.md` | `ct-data-explorer` (haiku, read-only), `ct-code-reviewer` (sonnet), `b2b-architect` (opus, plans only) | Separate context window, so only the summary comes back; per-agent `tools` allowlist (least privilege) and `model` (cost vs quality); the `description` decides when it gets delegated to |
| **Skills** | `.claude/skills/*/SKILL.md` | `ct-query` (read-only data lookup with `allowed-tools`), `ct-feature` (multi-phase workflow) | Progressive disclosure: only name and description stay in context until it's invoked; skills vs subagents (skills run in the main context, subagents are isolated); invoked by the model or by `/name` |
| **Hooks: PreToolUse** | `guard-env.sh` | Blocks Read/Edit/Write/Bash on `.env` (exit 2 + stderr) | Exit codes: 0 = proceed, 2 = block and send stderr to Claude, other = non-blocking error; matcher regex on the tool name; JSON on stdin |
| **Hooks: PostToolUse** | `lint-on-edit.sh` | `eslint --fix` after edits; remaining errors fed back with exit 2 | Runs after the tool succeeded, so it can't undo it, only give feedback; good for format/lint |
| **Hooks: Stop** | `stop-typecheck.sh` | Won't let Claude finish while there are type errors | `stop_hook_active` guard against infinite loops; exit 2 makes Claude continue |
| **Hooks: SessionStart** | `session-start.sh` | Puts branch and uncommitted files into context | stdout becomes context for this event |
| **Permissions** | `.claude/settings.json` → `permissions` | Allow safe npm scripts; deny `.env` and `git commit`/`push` | Precedence deny > ask > allow; settings scopes managed > CLI > local > project > user; rules (deterministic) vs hooks (programmable) vs CLAUDE.md (advisory only) |
| **Defense in depth** | `.env` protected 3 ways | `.gitignore` + permission deny + PreToolUse hook | Why CLAUDE.md alone ("don't read .env") is not a control |
| **Task decomposition** | `docs/decomposition.md` | Epics → tasks with dependencies, files, verification, ‖ parallel groups | Decompose by verifiable outcome; parallelize only tasks with disjoint files and no dependencies; plan mode / architect agent before large changes |
| **Verification loop** | `ct-feature` skill phase 4, Stop hook | typecheck + lint + browser check + run scripts twice | Give Claude a way to check its own work: tests, types, screenshots |

## Exercises
1. Ask Claude to "show me the .env". Watch the deny rule or hook block it, then explain which one fired and why.
2. Ask it to build **T1.1** from `docs/decomposition.md`. Watch it pick up `ct-feature`, delegate to `ct-data-explorer`, and the Stop hook typecheck.
3. Add a rule with no `paths:` and confirm it loads in every session (check with `/memory`).
4. Change `ct-code-reviewer` to `tools: Read` only and observe what it can no longer do.
