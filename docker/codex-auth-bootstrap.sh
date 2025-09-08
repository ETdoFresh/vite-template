#!/usr/bin/env sh
set -eu

# Write ~/.codex/auth.json from env, if provided
HOME_DIR="${HOME:-/root}"
DEST_DIR="$HOME_DIR/.codex"
DEST_FILE="$DEST_DIR/auth.json"

write_auth_json() {
  mkdir -p "$DEST_DIR"
  umask 077
  printf '%s' "$1" > "$DEST_FILE"
  echo "Wrote $DEST_FILE"
}

if [ "${CODEX_AUTH_JSON:-}" != "" ]; then
  # Use raw JSON string as-is (supports multiline)
  write_auth_json "$CODEX_AUTH_JSON"
elif [ "${CODEX_AUTH_JSON_B64:-}" != "" ]; then
  # Decode base64 -> JSON
  mkdir -p "$DEST_DIR"
  umask 077
  # shellcheck disable=SC2059
  echo "$CODEX_AUTH_JSON_B64" | base64 -d > "$DEST_FILE" 2>/dev/null || echo "$CODEX_AUTH_JSON_B64" | base64 --decode > "$DEST_FILE"
  echo "Decoded base64 and wrote $DEST_FILE"
fi

# Continue with original command
exec "$@"

