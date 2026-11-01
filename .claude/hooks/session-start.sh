#!/usr/bin/env bash
set -euo pipefail

cd "${CLAUDE_PROJECT_DIR:-.}"

# Local sessions: keep the Playwright browser in step with the installed
# playwright version (a no-op when it's already downloaded). Never block startup.
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  if [ -x node_modules/.bin/playwright ]; then
    node_modules/.bin/playwright install chromium >/dev/null 2>&1 ||
      echo "warning: playwright browser install failed; run: bunx playwright install chromium" >&2
  fi
  exit 0
fi

# Project dependencies (also needed by the lint-staged step in the git hooks).
bun install

# Chromium + its system libraries so Claude can run e2e tests and screenshot
# the app (see .claude/skills/view-app). Non-fatal: the CDN may be blocked.
node_modules/.bin/playwright install --with-deps chromium ||
  echo "warning: playwright browser install failed; e2e/screenshots unavailable" >&2

# Beads: `bd` ships with the cloud environment. Route git hooks through
# .beads/hooks so commits export issues to .beads/issues.jsonl; this must run
# after `bun install`, whose husky `prepare` step points hooksPath elsewhere.
if command -v bd >/dev/null 2>&1 && git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  git config beads.role maintainer
  git config core.hooksPath .beads/hooks
  chmod 700 .beads
fi
