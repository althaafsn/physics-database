#!/usr/bin/env python3
"""LLM-repair only records that still have validation errors (no cache)."""
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

from src.llm_client import DEFAULT_TIMEOUT_S, format_metrics_line
from src.llm_repair import apply_repair_to_record
from src.paths import PipelinePaths
from src.record_store import load_jsonl, save_jsonl


def _default_model() -> str:
    return (
        os.environ.get("LLM_REPAIR_MODEL")
        or os.environ.get("HALLIDAY_TAG_MODEL")
        or (
            "qwen2.5:3b"
            if os.environ.get("LLM_PROVIDER", "").strip().lower() in {"local", "ollama"}
            or os.environ.get("LOCAL_LLM_BASE_URL", "").strip()
            else "qwen3.6-35b"
        )
    )


def main() -> int:
    parser = argparse.ArgumentParser(description="Repair unfixed problem records via LLM")
    parser.add_argument("--limit", type=int, default=None)
    parser.add_argument("--ids", type=str, default=None, help="Comma-separated problem ids")
    args = parser.parse_args()

    paths = PipelinePaths.resolve(ROOT)
    records = load_jsonl(paths.gold_problems_path, lenient=True)
    targets = [r for r in records if r.errors]

    if args.ids:
        wanted = {x.strip() for x in args.ids.split(",") if x.strip()}
        targets = [r for r in targets if r.id in wanted]
    if args.limit is not None:
        targets = targets[: max(0, args.limit)]

    if not targets:
        print("No records with validation errors.")
        return 0

    model = _default_model()
    total = len(targets)
    print(f"LLM repair (no cache): {total} records | model={model}", flush=True)

    succeeded = 0
    failed = 0
    by_id = {r.id: r for r in records}

    for index, rec in enumerate(targets, start=1):
        issues = list(rec.errors)
        outcome = apply_repair_to_record(
            rec,
            issues,
            model=model,
            cache_dir=None,
            timeout_s=float(os.environ.get("NETRA_TIMEOUT_S", DEFAULT_TIMEOUT_S)),
            index=index,
            total=total,
        )
        by_id[rec.id] = outcome.record
        if outcome.succeeded and not outcome.record.errors:
            succeeded += 1
            status = "ok"
        elif outcome.succeeded:
            succeeded += 1
            status = "partial"
        else:
            failed += 1
            status = outcome.failure_reason or "failed"
        remaining = [e.code for e in outcome.record.errors]
        print(
            f"  [{index}/{total}] {rec.id} {status}"
            + (f" remaining={remaining}" if remaining else "")
            + f" | {format_metrics_line(outcome.metrics, cached=False)}",
            flush=True,
        )

    updated = list(by_id.values())
    save_jsonl(paths.gold_problems_path, updated)
    save_jsonl(paths.silver_problems_path, updated)
    save_jsonl(paths.legacy_problems_path, updated)

    unfixed = [r for r in updated if r.errors]
    review_dir = paths.review_dir
    review_dir.mkdir(parents=True, exist_ok=True)
    with (review_dir / "unfixed_errors.jsonl").open("w", encoding="utf-8") as fh:
        for rec in unfixed:
            fh.write(rec.model_dump_json() + "\n")

    print(
        json.dumps(
            {
                "attempted": total,
                "succeeded": succeeded,
                "failed": failed,
                "still_unfixed": len(unfixed),
                "model": model,
            },
            indent=2,
        ),
        flush=True,
    )
    return 0 if not unfixed else 1


if __name__ == "__main__":
    raise SystemExit(main())
