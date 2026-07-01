#!/usr/bin/env bash
# Rsync project files from your laptop to the EC2 instance.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
TF_DIR="$ROOT/deploy/ec2/terraform"

usage() {
  cat <<'EOF'
Usage: ./deploy/ec2/sync-to-server.sh [user@host]

  user@host  SSH target (default: ec2-user@<terraform elastic ip>)

Syncs code + parsed corpus to /opt/physics-database on the instance.
Excludes node_modules, .venv, out/, .git.

After sync, SSH in and run:
  sudo bash /opt/physics-database/deploy/ec2/finish-setup.sh
EOF
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

TARGET="${1:-}"
KEY="$(grep -E '^key_name' "$TF_DIR/terraform.tfvars" 2>/dev/null | sed 's/.*= *"\(.*\)".*/\1/' || echo physics-db)"
SSH_OPTS=(-i "${HOME}/.ssh/${KEY}.pem" -o StrictHostKeyChecking=accept-new)

if [[ -z "$TARGET" ]]; then
  command -v terraform >/dev/null 2>&1 || { echo "terraform required or pass user@host" >&2; exit 1; }
  IP="$(terraform -chdir="$TF_DIR" output -raw public_ip 2>/dev/null)" || true
  if [[ -z "$IP" ]]; then
    echo "Pass SSH target: ./deploy/ec2/sync-to-server.sh ec2-user@1.2.3.4" >&2
    exit 1
  fi
  TARGET="ec2-user@${IP}"
fi

echo "==> Syncing to ${TARGET}:/opt/physics-database/"

RSYNC_SSH="ssh ${SSH_OPTS[*]}"
rsync -avz --delete \
  -e "$RSYNC_SSH" \
  --exclude '.git' \
  --exclude 'node_modules' \
  --exclude 'out' \
  --exclude '.next' \
  --exclude 'admin/server/.venv' \
  --exclude 'admin/server/admin.db' \
  --include '.env.example' \
  --include '**/.env.example' \
  --exclude '.env' \
  --exclude '.env.*' \
  --exclude '**/.env' \
  --exclude '**/.env.*' \
  --exclude '.venv' \
  --exclude '.venv-marker' \
  --exclude '.tools' \
  --exclude 'models' \
  --exclude 'all_pdf' \
  --exclude 'output' \
  --exclude 'demo/output' \
  --exclude 'deploy/**/.terraform' \
  --exclude '**/.terraform' \
  --exclude '*.tfstate*' \
  --exclude '*.tfvars' \
  "$ROOT/" "${TARGET}:/opt/physics-database/"

echo "==> Done. Finish on the server:"
echo "    ssh ${SSH_OPTS[*]} ${TARGET}"
echo "    sudo bash /opt/physics-database/deploy/ec2/finish-setup.sh"
