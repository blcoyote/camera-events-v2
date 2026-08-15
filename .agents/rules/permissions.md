# Permissions Policy

The user has pre-approved permissions configured in `.claude/settings.json` and `.claude/settings.local.json`. These permissions apply to Antigravity as well.

## Pre-Approved Permissions

- **Web Requests / Docs:**
  - `docs.frigate.video`
  - `tanstack.com`
- **Git Operations:**
  - `git add *`
  - `git commit -m ...`
- **Skills & MCP Tools:**
  - `agentic-dev-team:*`
  - `context7` documentation queries (`resolve-library-id`, `query-docs`)
- **CLI Commands:**
  - `bd --help`
  - Standard test, build, lint, format commands (`bun run test`, `bun run lint`, `bun run check`, `bun run build`, etc.)

## Rule

Do not ask for confirmation on pre-approved operations. Only prompt or ask the user for permission when executing actions or accessing external domains/resources not covered by these permissions.
