#!/usr/bin/env bash
# =============================================================================
# verify-all.sh — one command to verify the whole ZakPOS stack
# =============================================================================
# Lanes:
#   1. server   — npm ci (if needed) + prisma generate + jest   (expect 490)
#   2. client   — npm ci (if needed) + jest                      (expect 73)
#   3. ocr      — python 3.11 venv + pytest        (expect 97; SKIP if 3.11
#                 is not on PATH — system python cannot build pinned wheels)
#   4. compose  — docker compose up --build + health curl smoke
#
# Any REAL failure exits nonzero. A SKIP is reported but does not fail.
# Flags/env:
#   --skip-compose | --skip-ocr | --skip-server | --skip-client
#   VERIFY_COMPOSE_DOWN=1   → `docker compose stop` after the smoke
set -uo pipefail

ROOT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$ROOT_DIR"

SKIP_SERVER=0 SKIP_CLIENT=0 SKIP_OCR=0 SKIP_COMPOSE=0
for a in "$@"; do
  case "$a" in
    --skip-server)  SKIP_SERVER=1 ;;
    --skip-client)  SKIP_CLIENT=1 ;;
    --skip-ocr)     SKIP_OCR=1 ;;
    --skip-compose) SKIP_COMPOSE=1 ;;
    *) echo "unknown flag: $a" >&2; exit 2 ;;
  esac
done

FAILED=0
RESULTS=()

banner() { echo; echo "════════ $1 ════════"; }
fail()   { FAILED=1; RESULTS+=("FAIL  $1"); }
pass()   { RESULTS+=("PASS  $1"); }
skip()   { RESULTS+=("SKIP  $1 — $2"); }

# ---------------------------------------------------------------------------
banner "1/4  server — NestJS unit tests"
if [ "$SKIP_SERVER" = 1 ]; then
  skip "server" "--skip-server"
else
  ( cd server
    [ -d node_modules ] || npm ci --no-audit --no-fund
    npx prisma generate
    npm test ) 2>&1 | tee /tmp/zakpos-server-tests.log | tail -5
  SV=$(grep -oE 'Tests: +[0-9,]+ passed' /tmp/zakpos-server-tests.log | tail -1)
  if [ -n "$SV" ] && ! grep -qE 'Test Suites: +[0-9]+ failed' /tmp/zakpos-server-tests.log; then
    pass "server ($SV)"
  else
    fail "server — see /tmp/zakpos-server-tests.log"
  fi
fi

# ---------------------------------------------------------------------------
banner "2/4  client — Next.js unit tests"
if [ "$SKIP_CLIENT" = 1 ]; then
  skip "client" "--skip-client"
else
  ( cd client
    [ -d node_modules ] || npm ci --no-audit --no-fund
    npm test ) 2>&1 | tee /tmp/zakpos-client-tests.log | tail -5
  if grep -qE 'Tests: +[0-9,]+ passed' /tmp/zakpos-client-tests.log && \
     ! grep -qE 'Test Suites: +[0-9]+ failed' /tmp/zakpos-client-tests.log; then
    CL=$(grep -oE 'Tests: +[0-9,]+ passed' /tmp/zakpos-client-tests.log | tail -1)
    pass "client ($CL)"
  else
    fail "client — see /tmp/zakpos-client-tests.log"
  fi
fi

# ---------------------------------------------------------------------------
banner "3/4  ocr — FastAPI pytest"
if [ "$SKIP_OCR" = 1 ]; then
  skip "ocr" "--skip-ocr"
else
  PY=""
  for cand in python3.11 py-3.11 "py -3.11"; do
    if [ "$cand" = "py -3.11" ]; then
      py -3.11 --version >/dev/null 2>&1 && PY="py -3.11" && break
    else
      command -v "$cand" >/dev/null 2>&1 && PY="$cand" && break
    fi
  done
  if [ -z "$PY" ]; then
    skip "ocr" "python 3.11 not on PATH (pinned wheels do not build on 3.14; CI uses 3.11)"
  else
    ( cd services/ocr
      [ -d venv ] || "$PY" -m venv venv
      case "$(uname -s)" in
        MINGW*|MSYS*|CYGWIN*) VP=venv/Scripts; EXE=.exe ;;
        *) VP=venv/bin; EXE= ;;
      esac
      "$VP/python$EXE" -m pip install -q -r requirements-test.txt
      "$VP/python$EXE" -m pytest -q ) 2>&1 | tee /tmp/zakpos-ocr-tests.log | tail -5
      if grep -qE '[0-9]+ passed' /tmp/zakpos-ocr-tests.log && \
         ! grep -qE '[0-9]+ (failed|error)' /tmp/zakpos-ocr-tests.log; then
        OC=$(grep -oE '[0-9]+ passed' /tmp/zakpos-ocr-tests.log | tail -1)
        pass "ocr ($OC)"
      else
        fail "ocr — see /tmp/zakpos-ocr-tests.log"
      fi
    fi
fi

# ---------------------------------------------------------------------------
banner "4/4  compose smoke — build + health checks"
if [ "$SKIP_COMPOSE" = 1 ]; then
  skip "compose" "--skip-compose"
elif ! command -v docker >/dev/null 2>&1; then
  skip "compose" "docker not installed"
else
  if [ ! -f server/.env ]; then
    echo "server/.env missing — generating from .env.example…"
    ./scripts/gen-or-copy-env.sh
  fi
  if ! docker compose up -d --build 2>&1 | tee /tmp/zakpos-compose-build.log | tail -6; then
    fail "compose — build/up error, see /tmp/zakpos-compose-build.log"
  else
    # git-bash native curl cannot write to /dev/null; use the OS null device.
    case "$(uname -s)" in MINGW*|MSYS*|CYGWIN*) NULLDEV=NUL ;; *) NULLDEV=/dev/null ;; esac
    wait_url() { # wait_url <name> <url> <deadline-seconds>
      local name="$1" url="$2" deadline="$3" waited=0
      while [ "$waited" -lt "$deadline" ]; do
        if curl -fsS -o "$NULLDEV" "$url"; then
          echo "  ✓ $name healthy ($url)"
          return 0
        fi
        sleep 5; waited=$((waited + 5))
      done
      echo "  ✗ $name NOT healthy ($url) after ${deadline}s"
      return 1
    }
    CS_FAIL=0
    wait_url "api  " http://localhost:39847/api/v1/health 180 || CS_FAIL=1
    wait_url "web  " http://localhost:41923/login         180 || CS_FAIL=1
    # First OCR boot downloads the trocr model; allow 10 min.
    wait_url "ocr  " http://localhost:58000/api/v1/health 600 || CS_FAIL=1
    if [ "$CS_FAIL" = 1 ]; then
      docker compose ps
      fail "compose smoke — health checks failed (see docker compose logs)"
    else
      pass "compose smoke (api+web+ocr healthy)"
      [ "${VERIFY_COMPOSE_DOWN:-0}" = 1 ] && docker compose stop
    fi
  fi
fi

# ---------------------------------------------------------------------------
banner "summary"
for r in "${RESULTS[@]}"; do echo "  $r"; done
if [ "$FAILED" = 1 ]; then
  echo; echo "verify-all: FAILED"
  exit 1
fi
echo; echo "verify-all: all executed lanes green"
