#!/usr/bin/env python3
"""Remove subpart text that is duplicated inline in a problem body.

Many problems store their sub-questions twice: once inline in ``body_md`` as a
``(a) … (b) …`` list and again in the structured ``subparts`` array. The reader
and exam preview render the body *and* the subparts list, so each sub-question
shows up twice. This tool strips the inline copy from the body (across the gold,
silver, and catalog tiers), leaving the problem stem in the body and the
sub-questions in the list. It is deterministic and idempotent.

Usage:
    python scripts/dedupe_subparts.py --dry-run   # report only
    python scripts/dedupe_subparts.py             # apply + write
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from src.clean import strip_duplicate_subparts
from src.paths import PipelinePaths
from src.record_store import load_jsonl, save_jsonl


def dedupe_file(path: Path, *, dry_run: bool) -> dict | None:
    if not path.is_file():
        return None
    records = load_jsonl(path, lenient=True)
    changed_ids = [record.id for record in records if strip_duplicate_subparts(record)]
    if changed_ids and not dry_run:
        save_jsonl(path, records)
    return {
        "path": str(path.relative_to(ROOT)) if path.is_relative_to(ROOT) else str(path),
        "total": len(records),
        "changed": len(changed_ids),
        "changed_ids": changed_ids,
    }


def dedupe_corpus(paths: PipelinePaths, *, dry_run: bool = False) -> dict:
    targets = [
        paths.gold_problems_path,
        paths.silver_problems_path,
        paths.catalog_problems_path,
    ]
    files = [result for path in targets if (result := dedupe_file(path, dry_run=dry_run))]
    return {
        "dry_run": dry_run,
        "total_changed": sum(result["changed"] for result in files),
        "files": files,
    }


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Strip subpart text duplicated inline in problem bodies",
    )
    parser.add_argument("--dry-run", action="store_true", help="Report changes without writing")
    args = parser.parse_args()

    paths = PipelinePaths.resolve(root=ROOT)
    result = dedupe_corpus(paths, dry_run=args.dry_run)
    print(json.dumps(result, indent=2))

    if not args.dry_run and result["total_changed"]:
        print(
            "\nRun `npm run export:data` to refresh public/data for the reader.",
            file=sys.stderr,
        )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
