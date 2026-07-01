#!/usr/bin/env python3
"""Tag catalog problems with Halliday/Resnick chapter + section labels."""
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

from src.halliday.classify import classify_heuristic, classify_llm
from src.halliday.tag_cache import load_cached_tags, save_cached_tags, tag_cache_key
from src.llm_client import _llm_provider
from src.paths import PipelinePaths
from src.record_store import load_jsonl


def _default_use_llm() -> bool:
    return _llm_provider() == "local"


def main() -> int:
    parser = argparse.ArgumentParser(description="Tag problems with Halliday taxonomy")
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--llm", action="store_true", help="Use local/cloud LLM classifier")
    mode.add_argument(
        "--heuristic",
        action="store_true",
        help="Use free keyword heuristic (no LLM)",
    )
    parser.add_argument("--no-cache", action="store_true", help="Ignore LLM tag cache")
    parser.add_argument("--limit", type=int, default=None)
    parser.add_argument("--ids", type=str, default=None, help="Comma-separated problem ids")
    args = parser.parse_args()

    use_llm = args.llm or (_default_use_llm() and not args.heuristic)
    paths = PipelinePaths.resolve(ROOT)
    catalog_path = paths.catalog_problems_path
    if not catalog_path.is_file():
        print(f"Missing {catalog_path}. Run sync_catalog.py first.", file=sys.stderr)
        return 1

    records = load_jsonl(catalog_path, lenient=True)
    if args.ids:
        wanted = {x.strip() for x in args.ids.split(",") if x.strip()}
        records = [r for r in records if r.id in wanted]
    if args.limit is not None:
        records = records[: max(0, args.limit)]

    out_dir = paths.parsed_dir / "halliday"
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / "tags.jsonl"
    cache_root = paths.llm_cache_dir

    tagged = 0
    cached = 0
    with out_path.open("w", encoding="utf-8") as fh:
        for rec in records:
            tags = None
            cache_key = tag_cache_key(rec)
            if use_llm and not args.no_cache:
                tags = load_cached_tags(cache_root, rec.id, cache_key)
                if tags is not None:
                    tags.method = "llm_cached"
                    cached += 1

            if tags is None:
                if use_llm:
                    tags = classify_llm(rec)
                    if tags.method == "llm":
                        save_cached_tags(cache_root, rec.id, cache_key, tags)
                else:
                    tags = classify_heuristic(rec)

            fh.write(json.dumps(tags.as_dict(), ensure_ascii=False) + "\n")
            fh.flush()
            tagged += 1
            if tagged % 10 == 0 or tagged == len(records):
                llm_n = tagged - cached
                print(f"  tagged {tagged}/{len(records)} ({cached} cached, {llm_n} llm calls)…", flush=True)

    method = "llm" if use_llm else "heuristic"
    print(f"Wrote {tagged} tags → {out_path}")
    print(f"Method: {method} | provider: {_llm_provider()} | cached: {cached}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
