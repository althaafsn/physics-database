#!/usr/bin/env python3
"""Repair problem images using heuristics + local vision LLM (Ollama)."""
from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))


def load_local_env() -> None:
    env_path = ROOT / "local.env"
    if not env_path.is_file():
        return
    for line in env_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip())


load_local_env()

from src.catalog import sync_catalog
from src.clean import clean_record
from src.paths import PipelinePaths
from src.record_store import load_jsonl, save_jsonl
from src.repair_images import needs_image_repair, repair_record_images
from src.validate import apply_validation
from src.vision_repair import needs_vision_image_repair, repair_record_images_vision


def main() -> int:
    parser = argparse.ArgumentParser(description="Vision + heuristic image repair")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--ids", help="Comma-separated problem IDs")
    parser.add_argument("--errors-only", action="store_true", help="Only records with image errors")
    args = parser.parse_args()

    paths = PipelinePaths.resolve(ROOT)
    id_filter = {x.strip() for x in (args.ids or "").split(",") if x.strip()} or None
    records = load_jsonl(paths.gold_problems_path, lenient=True)
    repaired: list[str] = []

    for record in records:
        if id_filter and record.id not in id_filter:
            continue
        if args.errors_only and not (
            needs_image_repair(record) or needs_vision_image_repair(record)
        ):
            continue

        clean_record(record)
        output_folder = Path(record.source.md).parent
        changed = False
        if needs_image_repair(record):
            changed = repair_record_images(record, output_folder, paths.assets_dir) or changed
        if needs_vision_image_repair(record):
            changed = (
                repair_record_images_vision(record, output_folder, paths.assets_dir, log=print)
                or changed
            )
        if changed:
            apply_validation(record)
            repaired.append(record.id)
            if args.dry_run:
                print(f"would repair {record.id}")

    if args.dry_run:
        print(json.dumps({"would_repair": repaired}, indent=2))
        return 0

    if repaired:
        save_jsonl(paths.gold_problems_path, records)
        silver = paths.silver_problems_path
        if silver.is_file():
            by_id = {r.id: r for r in records}
            merged = [by_id.get(r.id, r) for r in load_jsonl(silver, lenient=True)]
            save_jsonl(silver, merged)
        sync_catalog(paths)

    print(json.dumps({"repaired": len(repaired), "repaired_ids": repaired}, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
