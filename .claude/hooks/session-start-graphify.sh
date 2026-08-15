#!/bin/bash
set -euo pipefail

# graphify is installed persistently on the maintainer's own machine, so this
# hook only needs to run in ephemeral Claude Code on the web containers where
# graphify-out/ exists but the CLI itself isn't installed yet.
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

if ! command -v graphify >/dev/null 2>&1; then
  pip install --user --quiet graphifyy
fi

if [ -d "$HOME/.local/bin" ] && [ -n "${CLAUDE_ENV_FILE:-}" ]; then
  echo "export PATH=\"\$PATH:$HOME/.local/bin\"" >> "$CLAUDE_ENV_FILE"
fi
