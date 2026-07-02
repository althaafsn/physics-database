#!/usr/bin/env bash
# Run on the EC2 instance after sync-to-server.sh (as root or with sudo).
set -euo pipefail

APP_ROOT="/opt/physics-database"
ENV_BOOT="${APP_ROOT}/.ec2-bootstrap.env"
SERVER_DIR="${APP_ROOT}/admin/server"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [[ ! -f "$ENV_BOOT" ]]; then
  echo "Missing $ENV_BOOT — run Terraform apply first, then sync-to-server.sh" >&2
  exit 1
fi

# shellcheck disable=SC1090
source "$ENV_BOOT"

if [[ $EUID -ne 0 ]]; then
  echo "Re-run with sudo: sudo bash $0" >&2
  exit 1
fi

log() { printf '==> %s\n' "$*"; }

log "Python venv + dependencies"
sudo -u ec2-user bash -c "
  cd '$SERVER_DIR'
  python3.11 -m venv .venv
  .venv/bin/pip install -q --upgrade pip
  .venv/bin/pip install -q -r requirements.txt
  .venv/bin/pip install -q -r '$APP_ROOT/requirements-web.txt'
"

log "Node dependencies (export:data on publish)"
sudo -u ec2-user bash -c "
  cd '$APP_ROOT'
  npm ci --omit=dev
"

CORS="${CORS_ORIGIN:-}"
if [[ -z "$CORS" ]]; then
  CORS="http://localhost:3000"
fi

# Preserve LLM secrets across re-runs of finish-setup (sync does not copy .env).
LLM_PROVIDER_SAVED=""
OPENROUTER_KEY_SAVED=""
TUTOR_MODEL_SAVED=""
if [[ -f "$SERVER_DIR/.env" ]]; then
  LLM_PROVIDER_SAVED="$(grep -E '^LLM_PROVIDER=' "$SERVER_DIR/.env" 2>/dev/null | cut -d= -f2- || true)"
  OPENROUTER_KEY_SAVED="$(grep -E '^OPENROUTER_API_KEY=' "$SERVER_DIR/.env" 2>/dev/null | cut -d= -f2- || true)"
  TUTOR_MODEL_SAVED="$(grep -E '^TUTOR_MODEL=' "$SERVER_DIR/.env" 2>/dev/null | cut -d= -f2- || true)"
fi
LLM_PROVIDER_VAL="${LLM_PROVIDER_SAVED:-openrouter}"
OPENROUTER_KEY_VAL="${OPENROUTER_KEY_SAVED:-}"
TUTOR_MODEL_VAL="${TUTOR_MODEL_SAVED:-google/gemini-2.5-flash-preview}"

log "Writing admin/server/.env"
cat >"$SERVER_DIR/.env" <<EOF
APP_ENV=production
JWT_SECRET=${JWT_SECRET}
ADMIN_ALLOWED_EMAILS=${ADMIN_EMAIL}
ALLOW_MOCK_BILLING=false
ALLOW_PUBLIC_REGISTRATION=false
CORS_ORIGINS=${CORS}

# AI tutor — add OPENROUTER_API_KEY below (https://openrouter.ai/keys), then:
#   sudo systemctl restart physics-admin
LLM_PROVIDER=${LLM_PROVIDER_VAL}
OPENROUTER_API_KEY=${OPENROUTER_KEY_VAL}
TUTOR_MODEL=${TUTOR_MODEL_VAL}
TUTOR_RATE_LIMIT_PER_HOUR=20
TUTOR_DAILY_TOKEN_BUDGET=400000
TUTOR_DAILY_REQUEST_BUDGET=600
EOF
chown ec2-user:ec2-user "$SERVER_DIR/.env"
chmod 600 "$SERVER_DIR/.env"

log "Installing systemd unit"
cp "$SCRIPT_DIR/physics-admin.service" /etc/systemd/system/physics-admin.service
systemctl daemon-reload
systemctl enable physics-admin
systemctl restart physics-admin

if [[ -n "${API_DOMAIN:-}" ]]; then
  log "Configuring Caddy for https://${API_DOMAIN}"
  cat >/etc/caddy/Caddyfile <<EOF
{
	email ${ADMIN_EMAIL}
}

${API_DOMAIN} {
	reverse_proxy 127.0.0.1:8000
}
EOF
  systemctl enable caddy
  systemctl restart caddy
  log "Point DNS A record: ${API_DOMAIN} → $(curl -fsS http://169.254.169.254/latest/meta-data/public-ipv4 2>/dev/null || hostname -I | awk '{print $1}')"
else
  log "No API_DOMAIN — API listens on 127.0.0.1:8000 only (not reachable from browser)."
  log "Set api_domain in terraform.tfvars and re-apply, or add Caddy manually."
fi

sleep 2
if systemctl is-active --quiet physics-admin; then
  log "physics-admin: running"
  curl -fsS http://127.0.0.1:8000/health && echo
else
  journalctl -u physics-admin -n 30 --no-pager
  exit 1
fi

log "Create editor login (first time):"
echo "  cd $SERVER_DIR"
echo "  sudo -u ec2-user PHYSICS_DB_ROOT=$APP_ROOT PYTHONPATH=$APP_ROOT .venv/bin/python scripts/register_admin.py ${ADMIN_EMAIL} 'your-password'"
