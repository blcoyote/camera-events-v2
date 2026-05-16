#!/bin/sh
set -e
# Read SESSION_SECRET from Docker secret file if present.
# Docker mounts secrets at /run/secrets/<name> with 0444 permissions.
if [ -f /run/secrets/session_secret ]; then
  SESSION_SECRET="$(cat /run/secrets/session_secret)"
  export SESSION_SECRET
fi
exec "$@"
