#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from src.catalog import sync_catalog
from src.paths import PipelinePaths
from src.record_store import load_jsonl, save_jsonl
from src.repair_images import needs_image_repair, repair_record_images
from src.schema import ProblemRecord
from src.validate import apply_validation


def repair_corpus(paths: PipelinePaths, *, dry_run: bool = False) -> dict:
    records = load_jsonl(paths.gold_problems_path)
    repaired_ids: list[str] = []
    skipped = 0

    for record in records:
        if not needs_image_repair(record):
            skipped += 1
            continue
        output_folder = Path(record.source.md).parent
        if repair_record_images(record, output_folder, paths.assets_dir):
            apply_validation(record)
            repaired_ids.append(record.id)

    if not dry_run and repaired_ids:
        save_jsonl(paths.gold_problems_path, records)
        silver_path = paths.silver_problems_path
        if silver_path.is_file():
            silver = load_jsonl(silver_path)
            by_id = {r.id: r for r in records}
            merged = [by_id.get(r.id, r) for r in silver]
            for rid in repaired_ids:
                if rid in by_id and rid not in {r.id for r in silver}:
                    merged.append(by_id[rid])
            save_jsonl(silver_path, merged)
        sync_catalog(paths)

    return {
        "total": len(records),
        "skipped": skipped,
        "repaired": len(repaired_ids),
        "repaired_ids": repaired_ids,
        "dry_run": dry_run,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Repair broken problem images in gold corpus")
    parser.add_argument("--dry-run", action="store_true", help="Report changes without writing")
    args = parser.parse_args()

    paths = PipelinePaths.resolve()
    result = repair_corpus(paths, dry_run=args.dry_run)
    print(json.dumps(result, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
