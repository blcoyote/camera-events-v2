#!/bin/bash
set -euo pipefail

# Only run in Claude Code cloud sessions.
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "${CLAUDE_PROJECT_DIR:-.}"

# Project dependencies (also needed by the lint-staged step in the git hooks).
bun install

# Beads: `bd` ships with the cloud environment. Route git hooks through
# .beads/hooks so commits export issues to .beads/issues.jsonl; this must run
# after `bun install`, whose husky `prepare` step points hooksPath elsewhere.
if command -v bd >/dev/null 2>&1; then
  git config beads.role maintainer
  git config core.hooksPath .beads/hooks
  chmod 700 .beads
fi
