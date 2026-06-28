#!/usr/bin/env bash
# Run with ADMIN credentials (not btree-deploy). Creates a customer managed policy
# and attaches it to btree-deploy. Avoids the 2048-char inline policy limit.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
POLICY_FILE="${POLICY_FILE:-$ROOT/iam-deploy-policy.json}"
USER_NAME="${DEPLOY_USER:-btree-deploy}"
POLICY_NAME="${MANAGED_POLICY_NAME:-PhysicsDbDeploy}"
ACCOUNT_ID="$(aws sts get-caller-identity --query Account --output text)"
POLICY_ARN="arn:aws:iam::${ACCOUNT_ID}:policy/${POLICY_NAME}"

if [[ ! -f "$POLICY_FILE" ]]; then
  echo "Policy file not found: $POLICY_FILE" >&2
  exit 1
fi

if aws iam get-policy --policy-arn "$POLICY_ARN" >/dev/null 2>&1; then
  VERSION_ID="$(aws iam create-policy-version \
    --policy-arn "$POLICY_ARN" \
    --policy-document "file://${POLICY_FILE}" \
    --set-as-default \
    --query 'PolicyVersion.VersionId' \
    --output text)"
  echo "Updated managed policy ${POLICY_ARN} (version ${VERSION_ID})"
else
  POLICY_ARN="$(aws iam create-policy \
    --policy-name "$POLICY_NAME" \
    --policy-document "file://${POLICY_FILE}" \
    --query 'Policy.Arn' \
    --output text)"
  echo "Created managed policy ${POLICY_ARN}"
fi

if aws iam list-attached-user-policies --user-name "$USER_NAME" \
  --query "AttachedPolicies[?PolicyArn=='${POLICY_ARN}'].PolicyArn" \
  --output text | grep -q .; then
  echo "Already attached to ${USER_NAME}"
else
  aws iam attach-user-policy --user-name "$USER_NAME" --policy-arn "$POLICY_ARN"
  echo "Attached ${POLICY_ARN} to user ${USER_NAME}"
fi

echo "Done. Verify with:"
echo "  aws s3 ls | grep physics-db-static"
