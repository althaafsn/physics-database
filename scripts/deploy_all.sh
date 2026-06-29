#!/usr/bin/env bash
# Full deploy: sync corpus → repair images → LLM-fix errors → build → AWS.
# Remaining PDFs: run ./scripts/convert_pending_cpu.sh in a separate terminal.
set -euo pipefail
cd "$(dirname "$0")/.."

if [[ -f local.env ]]; then set -a; source local.env; set +a; fi
if [[ -f /home/althaaf/JOB_SEARCH/.venv-marker/bin/activate ]]; then
  # shellcheck disable=SC1091
  source /home/althaaf/JOB_SEARCH/.venv-marker/bin/activate
fi

echo "==> 1/6 Merge silver into gold + extract any pending bronze…"
python scripts/ingest.py scan
python scripts/ingest.py process

echo "==> 2/6 Repair broken diagram attachments…"
python scripts/repair_images.py

echo "==> 3/6 LLM repair on records with parse errors…"
python scripts/ingest.py process --repair-all --llm-repair

echo "==> 4/6 Sync public catalog…"
python scripts/sync_catalog.py

echo "==> 5/6 Build static site…"
npm run build:static

echo "==> 6/6 Deploy to S3 + CloudFront…"
./deploy/aws/deploy.sh

echo "==> Deploy complete."
