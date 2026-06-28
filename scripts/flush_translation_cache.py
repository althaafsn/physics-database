#!/usr/bin/env python3
"""Apply cached LLM translations to gold corpus and sync the UI catalog."""
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from src.catalog import sync_catalog
from src.llm_translate import apply_translation_to_record, cache_key, load_cached_translation
from src.paths import PipelinePaths
from src.record_store import load_jsonl, save_jsonl


def main() -> int:
    paths = PipelinePaths.resolve()
    gold_path = paths.gold_problems_path
    if not gold_path.is_file():
        print(f"No gold corpus at {gold_path}", file=sys.stderr)
        return 1

    progress_path = paths.llm_cache_dir / "translate_progress.json"
    model = "unknown"
    if progress_path.is_file():
        model = json.loads(progress_path.read_text(encoding="utf-8")).get("model", model)

    gold = load_jsonl(gold_path, lenient=True)
    by_id = {rec.id: rec for rec in gold}
    applied = 0
    skipped = 0

    for rec in gold:
        key = cache_key(rec)
        cached = load_cached_translation(paths.llm_cache_dir, rec.id, key)
        if cached is None:
            skipped += 1
            continue
        by_id[rec.id] = apply_translation_to_record(rec, cached, model=model)
        applied += 1

    updated = list(by_id.values())
    updated.sort(key=lambda r: (r.level or "", r.year or 0, r.document_slug, r.problem_number, r.id))
    save_jsonl(gold_path, updated)

    catalog_meta = sync_catalog(paths)
    print(
        json.dumps(
            {
                "applied": applied,
                "skipped_no_cache": skipped,
                "gold_total": len(updated),
                "catalog_total": catalog_meta.get("catalog_total"),
            },
            indent=2,
        )
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
