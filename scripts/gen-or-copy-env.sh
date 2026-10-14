#!/usr/bin/env sh
# =============================================================================
# gen-or-copy-env.sh - create server/.env from the tracked .env.example
# =============================================================================
# Idempotent: an existing server/.env is never touched. The template ships
# JWT_SECRET empty on purpose; this script generates 32 random hex chars for
# it. POSIX sh - works on Linux, macOS and git-bash on Windows.
set -eu

ROOT_DIR=$(CDPATH= cd -- "$( dirname -- "$0" )/.." && pwd )
TEMPLATE="$ROOT_DIR/.env.example"
TARGET="$ROOT_DIR/server/.env"

if [ ! -f "$TEMPLATE" ]; then
  echo "ERROR: $TEMPLATE not found (run from a full clone of the repo)" >&2
  exit 1
fi

if [ -f "$TARGET" ]; then
  echo "server/.env already exists - leaving it untouched."
  exit 0
fi

# 32 random hex chars, portable across openssl / python3 / od.
if command -v openssl >/dev/null 2>&1; then
  SECRET=$( openssl rand -hex 32 )
elif command -v python3 >/dev/null 2>&1; then
  SECRET=$( python3 -c "import secrets; print(secrets.token_hex(32))" )
else
  # POSIX fallback: hexdump of the OS entropy device.
  SECRET=$( od -An -tx1 -N 32 /dev/urandom | tr -d ' \n' )
fi

# Fill the template's empty JWT_SECRET line with the generated value.
sed "s/^JWT_SECRET=.*/JWT_SECRET=${SECRET}/" "$TEMPLATE" > "$TARGET"
chmod 600 "$TARGET" 2>/dev/null || true

echo "Created server/.env with a random JWT_SECRET."
echo "Next: docker compose up -d --build"
