#!/usr/bin/env bash
# Build static site and upload to S3 + CloudFront.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

REGION="${AWS_REGION:-us-east-1}"
PROJECT="${PROJECT_NAME:-physics-db}"
TF_DIR="$ROOT/deploy/aws/terraform"

log() { printf '==> %s\n' "$*"; }
die() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || die "Missing command: $1"
}

ensure_terraform() {
  if command -v terraform >/dev/null 2>&1; then
    return 0
  fi
  log "Installing Terraform to /tmp/terraform …"
  require_cmd curl
  require_cmd unzip
  local ver="1.9.8"
  curl -fsSL "https://releases.hashicorp.com/terraform/${ver}/terraform_${ver}_linux_amd64.zip" -o /tmp/terraform.zip
  unzip -o /tmp/terraform.zip -d /tmp >/dev/null
  export PATH="/tmp:$PATH"
}

main() {
  require_cmd aws
  require_cmd npm
  ensure_terraform

  log "Building static site…"
  npm run build:static

  log "Creating/updating S3 bucket + CloudFront…"
  terraform -chdir="$TF_DIR" init -input=false
  terraform -chdir="$TF_DIR" apply -auto-approve \
    -var="aws_region=${REGION}" \
    -var="project_name=${PROJECT}"

  local bucket dist_id url
  bucket="$(terraform -chdir="$TF_DIR" output -raw bucket_name)"
  dist_id="$(terraform -chdir="$TF_DIR" output -raw cloudfront_distribution_id)"
  url="$(terraform -chdir="$TF_DIR" output -raw site_url)"

  log "Uploading out/ → s3://${bucket}/ …"
  aws s3 sync "$ROOT/out" "s3://${bucket}" --delete --region "$REGION"

  log "Invalidating CloudFront cache…"
  aws cloudfront create-invalidation \
    --distribution-id "$dist_id" \
    --paths "/*" >/dev/null

  log "Deployed: ${url}"
  log "Typical cost: ~\$0.50–\$2/mo for light traffic (S3 + CloudFront)."
}

main "$@"
