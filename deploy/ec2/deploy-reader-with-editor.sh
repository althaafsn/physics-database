#!/usr/bin/env bash
# Build static site with editor enabled and deploy to S3/CloudFront.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
EC2_TF="$ROOT/deploy/ec2/terraform"
AWS_TF="$ROOT/deploy/aws/terraform"

API_URL="${NEXT_PUBLIC_ADMIN_API_URL:-}"
if [[ -z "$API_URL" ]]; then
  if command -v terraform >/dev/null 2>&1 && [[ -f "$EC2_TF/terraform.tfstate" ]]; then
    API_URL="$(terraform -chdir="$EC2_TF" output -raw api_url_hint 2>/dev/null | grep -o 'https\?://[^ ]*' | head -1 || true)"
  fi
fi

if [[ -z "$API_URL" || "$API_URL" == http://* ]]; then
  echo "Set NEXT_PUBLIC_ADMIN_API_URL to your HTTPS API URL (needs api_domain in terraform.tfvars)." >&2
  echo "  export NEXT_PUBLIC_ADMIN_API_URL=https://api.yourdomain.com" >&2
  exit 1
fi

export NEXT_PUBLIC_ENABLE_ADMIN=true
export NEXT_PUBLIC_ADMIN_API_URL="$API_URL"

log() { printf '==> %s\n' "$*"; }

log "Building with editor → ${API_URL}"
cd "$ROOT"
npm run build:static

log "Deploying to S3 + CloudFront…"
REGION="${AWS_REGION:-us-east-1}"
terraform -chdir="$AWS_TF" init -input=false >/dev/null
BUCKET="$(terraform -chdir="$AWS_TF" output -raw bucket_name)"
DIST="$(terraform -chdir="$AWS_TF" output -raw cloudfront_distribution_id)"
SITE="$(terraform -chdir="$AWS_TF" output -raw site_url)"

aws s3 sync "$ROOT/out" "s3://${BUCKET}" --delete --region "$REGION"
aws cloudfront create-invalidation --distribution-id "$DIST" --paths '/*' >/dev/null

log "Reader: ${SITE}"
log "Editor: ${SITE}/admin/login"
log "API:    ${API_URL}"
