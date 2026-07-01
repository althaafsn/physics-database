#!/usr/bin/env bash
# Full labfisika.com setup: static site + EC2 admin API.
# Prerequisite: attach deploy IAM policy once (see deploy/aws/attach-deploy-policy.sh with admin creds).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
AWS_TF="$ROOT/deploy/aws/terraform"
EC2_TF="$ROOT/deploy/ec2/terraform"
DOMAIN="labfisika.com"
KEY="${HOME}/.ssh/physics-db.pem"
ADMIN_EMAIL="${ADMIN_EMAIL:-$(grep -E '^admin_email' "$(dirname "${BASH_SOURCE[0]}")/ec2/terraform/terraform.tfvars" 2>/dev/null | sed 's/.*= *"\(.*\)".*/\1/')}"

log() { printf '==> %s\n' "$*"; }
die() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }

require_cmd() { command -v "$1" >/dev/null 2>&1 || die "Missing: $1"; }

check_aws_perms() {
  if ! aws route53 list-hosted-zones-by-name --dns-name "$DOMAIN" --max-items 1 >/dev/null 2>&1; then
    die "btree-deploy needs Route53 + EC2 permissions. Run once with admin AWS creds:
  cd deploy/aws && AWS_PROFILE=<admin> bash attach-deploy-policy.sh
Then retry this script."
  fi
}

check_pem() {
  [[ -f "$KEY" ]] || die "Missing SSH key: $KEY"
  chmod 600 "$KEY"
  log "SSH key OK: $KEY"
}

main() {
  require_cmd aws
  require_cmd npm
  require_cmd terraform
  require_cmd rsync
  check_pem
  check_aws_perms

  log "1/5 Terraform: CloudFront + ACM + Route53 for ${DOMAIN}"
  terraform -chdir="$AWS_TF" init -input=false
  terraform -chdir="$AWS_TF" apply -auto-approve
  SITE_URL="$(terraform -chdir="$AWS_TF" output -raw site_url)"
  log "Site URL: ${SITE_URL}"

  log "2/5 Terraform: EC2 admin API (api.${DOMAIN})"
  terraform -chdir="$EC2_TF" init -input=false
  terraform -chdir="$EC2_TF" apply -auto-approve
  EC2_IP="$(terraform -chdir="$EC2_TF" output -raw public_ip)"
  log "API host: api.${DOMAIN} (${EC2_IP})"
  log "Waiting 90s for EC2 bootstrap…"
  sleep 90

  log "3/5 Sync code to EC2"
  "$ROOT/deploy/ec2/sync-to-server.sh" "ec2-user@${EC2_IP}"

  log "4/5 Finish API setup on EC2"
  ssh -i "$KEY" -o StrictHostKeyChecking=accept-new "ec2-user@${EC2_IP}" \
    "sudo bash /opt/physics-database/deploy/ec2/finish-setup.sh"

  log "5/5 Create admin user (set password below)"
  [[ -n "$ADMIN_EMAIL" ]] || die "Set ADMIN_EMAIL env var or admin_email in deploy/ec2/terraform/terraform.tfvars"
  read -r -s -p "Admin password for ${ADMIN_EMAIL}: " ADMIN_PW
  echo
  ssh -i "$KEY" "ec2-user@${EC2_IP}" \
    "cd /opt/physics-database/admin/server && sudo -u ec2-user PHYSICS_DB_ROOT=/opt/physics-database PYTHONPATH=/opt/physics-database .venv/bin/python scripts/register_admin.py ${ADMIN_EMAIL} '${ADMIN_PW}'"

  log "Deploying static site with editor"
  export NEXT_PUBLIC_ADMIN_API_URL="https://api.${DOMAIN}"
  "$ROOT/deploy/aws/deploy.sh"

  log "Done."
  log "  Reader: https://${DOMAIN}"
  log "  Editor: https://${DOMAIN}/admin/login"
  log "  API:    https://api.${DOMAIN}/health"
}

main "$@"
