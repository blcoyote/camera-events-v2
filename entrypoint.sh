#!/bin/sh
set -e

SECRET_FILE=/app/data/session_secret

# Auto-generate the session secret on first run and persist it in the data volume.
# Subsequent container restarts and image updates read the same value from the file,
# so existing sessions survive redeployments as long as the volume is intact.
# An explicit SESSION_SECRET env var takes precedence (allows manual override).
if [ -z "$SESSION_SECRET" ]; then
  if [ ! -f "$SECRET_FILE" ]; then
    openssl rand -base64 48 > "$SECRET_FILE"
    chmod 600 "$SECRET_FILE"
  fi
  SESSION_SECRET="$(cat "$SECRET_FILE")"
  export SESSION_SECRET
fi

exec "$@"
