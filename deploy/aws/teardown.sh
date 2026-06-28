#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
REGION="${AWS_REGION:-us-east-1}"
PROJECT="${PROJECT_NAME:-physics-db}"
TF_DIR="$ROOT/deploy/aws/terraform"

if command -v terraform >/dev/null 2>&1 && [ -d "$TF_DIR" ]; then
  terraform -chdir="$TF_DIR" destroy -auto-approve \
    -var="aws_region=${REGION}" \
    -var="project_name=${PROJECT}" 2>/dev/null || true
fi

echo "Static site infrastructure removed (or was already gone)."
