#!/usr/bin/env bash
# Convert unparsed PDFs one at a time on CPU, extract + repair after each.
# Deploys once at the end. Run from repo root.
set -euo pipefail
cd "$(dirname "$0")/.."

export PHYSICS_MARKER_CPU=1

if [[ -f local.env ]]; then set -a; source local.env; set +a; fi
if [[ -f /home/althaaf/JOB_SEARCH/.venv-marker/bin/activate ]]; then
  # shellcheck disable=SC1091
  source /home/althaaf/JOB_SEARCH/.venv-marker/bin/activate
fi

MAX="${1:-99}"
count=0

process_bronze_ready() {
  python scripts/ingest.py scan
  mapfile -t slugs < <(python - <<'PY'
import json
from src.ingest_registry import IngestRegistryStore, IngestStage
from src.paths import PipelinePaths
from src.record_store import migrate_legacy_problems

paths = PipelinePaths.resolve()
store = IngestRegistryStore(paths.registry_path)
silver = migrate_legacy_problems(paths.silver_problems_path, paths.legacy_problems_path)
by_slug: dict[str, list] = {}
for rec in silver:
    by_slug.setdefault(rec.document_slug, []).append(rec)
store.scan_paths(paths, silver_by_slug=by_slug)
for slug, entry in sorted(store.documents.items()):
    if entry.stage == IngestStage.BRONZE_READY:
        print(slug)
PY
)
  for slug in "${slugs[@]}"; do
    [[ -z "$slug" ]] && continue
    echo "==> Extracting: $slug"
    python scripts/ingest.py process --slug "$slug" --llm-repair
    python scripts/repair_images.py
    python scripts/sync_catalog.py
  done
}

echo "==> Processing any bronze-ready documents first…"
process_bronze_ready

while [[ "$count" -lt "$MAX" ]]; do
  if python scripts/ingest.py convert --pending --max 1 --dry-run 2>&1 | grep -q 'No PDFs pending'; then
    echo "==> No more PDFs to convert."
    break
  fi

  echo "==> Converting PDF $((count + 1)) (CPU, ~15–45 min each)…"
  if ! python scripts/ingest.py convert --pending --max 1 --timeout 7200; then
    echo "WARNING: conversion failed, continuing…" >&2
  fi
  process_bronze_ready
  count=$((count + 1))
done

echo "==> Final LLM pass on remaining errors…"
python scripts/ingest.py process --repair-all --llm-repair || true
python scripts/repair_images.py
python scripts/sync_catalog.py

echo "==> Building and deploying…"
npm run build:static
./deploy/aws/deploy.sh

echo "==> Done. Converted $count PDF(s) this run."
