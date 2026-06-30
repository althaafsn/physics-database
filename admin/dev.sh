#!/usr/bin/env bash
# Run admin API + main Next.js app locally.
set -euo pipefail
ADMIN_ROOT="$(cd "$(dirname "$0")" && pwd)"
DB_ROOT="$(cd "$ADMIN_ROOT/.." && pwd)"

export PHYSICS_DB_ROOT="$DB_ROOT"
export PYTHONPATH="$DB_ROOT:${PYTHONPATH:-}"

if [[ -f "$ADMIN_ROOT/server/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$ADMIN_ROOT/server/.env"
  set +a
fi

# Tokens must survive across requests when JWT_SECRET is empty in .env.
if [[ -z "${JWT_SECRET:-}" ]]; then
  DEV_JWT_FILE="$ADMIN_ROOT/server/.dev-jwt-secret"
  if [[ -f "$DEV_JWT_FILE" ]]; then
    export JWT_SECRET="$(<"$DEV_JWT_FILE")"
  else
    export JWT_SECRET="dev-local-$(openssl rand -hex 24)"
    printf '%s' "$JWT_SECRET" >"$DEV_JWT_FILE"
  fi
fi

export NEXT_PUBLIC_ENABLE_ADMIN="${NEXT_PUBLIC_ENABLE_ADMIN:-true}"
export NEXT_PUBLIC_ADMIN_API_URL="${NEXT_PUBLIC_ADMIN_API_URL:-http://localhost:8000}"

API_PID=""
WEB_PID=""

cleanup() {
  [[ -n "$API_PID" ]] && kill "$API_PID" 2>/dev/null || true
  [[ -n "$WEB_PID" ]] && kill "$WEB_PID" 2>/dev/null || true
}
trap cleanup EXIT

echo "==> Physics DB (reader + editor)"
echo "    Corpus: $DB_ROOT"
echo "    Reader: http://localhost:3000"
echo "    Editor: http://localhost:3000/admin/problems"
echo "    API:    http://localhost:8000"
echo ""
echo "    Sign in at /admin/login (mock subscribe on /admin/subscribe when needed)."
echo ""

if [[ ! -d "$ADMIN_ROOT/server/.venv" ]]; then
  echo "==> Creating Python venv…"
  python3 -m venv "$ADMIN_ROOT/server/.venv"
  "$ADMIN_ROOT/server/.venv/bin/pip" install -q -r "$ADMIN_ROOT/server/requirements.txt"
  "$ADMIN_ROOT/server/.venv/bin/pip" install -q -r "$DB_ROOT/requirements-web.txt"
fi

(
  cd "$ADMIN_ROOT/server"
  exec "$ADMIN_ROOT/server/.venv/bin/uvicorn" physics_admin.main:app --reload --host 0.0.0.0 --port 8000
) &
API_PID=$!

sleep 2

(
  cd "$DB_ROOT"
  exec npm run dev
) &
WEB_PID=$!

wait
