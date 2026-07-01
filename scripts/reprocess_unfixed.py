#!/usr/bin/env python3
"""Recover unfixed problems: symbol-restore LLM, then Marker re-convert affected PDFs."""
from __future__ import annotations

import argparse
import json
import os
import subprocess
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

from src.clean import clean_record
from src.bronze_convert import convert_pending_pdfs, marker_extra_args_from_env, resolve_marker_argv
from src.paths import PipelinePaths
from src.record_store import load_jsonl, save_jsonl
from src.symbol_restore import restore_symbols_llm
from src.validate import sync_flags_from_errors, validate_record


def _load_unfixed(paths: PipelinePaths) -> list:
    # Always source from the current gold corpus rather than the
    # parsed/review/unfixed_errors.jsonl cache: that file is a stale snapshot
    # from whenever it was last written and can silently reintroduce already
    # fixed (or manually reverted/corrected) content into a new repair run.
    gold = load_jsonl(paths.gold_problems_path, lenient=True)
    return [r for r in gold if r.errors]


def _save_unfixed(paths: PipelinePaths, records: list) -> None:
    paths.review_dir.mkdir(parents=True, exist_ok=True)
    with (paths.review_dir / "unfixed_errors.jsonl").open("w", encoding="utf-8") as fh:
        for rec in records:
            if rec.errors:
                fh.write(rec.model_dump_json() + "\n")


def _merge_into_gold(paths: PipelinePaths, updated: dict[str, object]) -> list:
    gold = load_jsonl(paths.gold_problems_path, lenient=True)
    merged = [updated.get(r.id, r) for r in gold]
    save_jsonl(paths.gold_problems_path, merged)
    save_jsonl(paths.silver_problems_path, merged)
    save_jsonl(paths.legacy_problems_path, merged)
    return merged


def phase_heuristic_clean(paths: PipelinePaths, targets: list) -> tuple[int, list]:
    """Run deterministic clean + revalidate (footers, HTML math, false-positive symbols)."""
    updated: dict[str, object] = {}
    fixed = 0
    print(f"Phase 0: heuristic clean + revalidate on {len(targets)} records…", flush=True)
    for rec in targets:
        before = bool(rec.errors)
        clean_record(rec)
        attach_flags = [
            f for f in rec.flags if f.startswith("missing_image:") or f == "expected_image_missing"
        ]
        rec.errors = validate_record(rec)
        rec.flags = sync_flags_from_errors(rec.errors, attach_flags)
        updated[rec.id] = rec
        if before and not rec.errors:
            fixed += 1
            print(f"  {rec.id} ok (clean)", flush=True)
    _merge_into_gold(paths, updated)
    gold = load_jsonl(paths.gold_problems_path, lenient=True)
    still = [r for r in gold if r.errors]
    _save_unfixed(paths, still)
    return fixed, still


def phase_symbol_restore(paths: PipelinePaths, targets: list) -> tuple[int, int, list]:
    fixed = 0
    failed = 0
    updated: dict[str, object] = {}
    total = len(targets)
    print(f"Phase 1: symbol-restore LLM on {total} records…", flush=True)
    for i, rec in enumerate(targets, start=1):
        issues = list(rec.errors)
        outcome = restore_symbols_llm(rec, issues)
        updated[rec.id] = outcome.record
        if outcome.succeeded:
            fixed += 1
            print(f"  [{i}/{total}] {rec.id} ok", flush=True)
        else:
            failed += 1
            print(f"  [{i}/{total}] {rec.id} {outcome.failure}", flush=True)
    _merge_into_gold(paths, updated)
    gold = load_jsonl(paths.gold_problems_path, lenient=True)
    still = [r for r in gold if r.errors]
    _save_unfixed(paths, still)
    return fixed, failed, still


def phase_marker_reconvert(paths: PipelinePaths, slugs: set[str], *, timeout_s: float) -> list[str]:
    if not slugs:
        return []
    items = [(slug, paths.pdf_path_for_slug(slug)) for slug in sorted(slugs)]
    items = [(s, p) for s, p in items if p.is_file()]
    missing = sorted(slugs - {s for s, _ in items})
    if missing:
        print(f"Warning: PDFs not found for: {missing}", flush=True)
    if not items:
        return []

    print(
        f"Phase 2: Marker re-convert {len(items)} PDF(s) "
        f"(high DPI + force OCR; set MARKER_USE_LLM=1 for Marker+Ollama)…",
        flush=True,
    )
    marker_argv = resolve_marker_argv()
    extra = marker_extra_args_from_env()
    results = convert_pending_pdfs(
        paths,
        items,
        marker_argv=marker_argv,
        marker_extra_args=extra,
        force=True,
        timeout_s=timeout_s,
        log=print,
    )
    ok_slugs = [r.slug for r in results if r.ok]
    for r in results:
        if not r.ok:
            print(f"  Marker failed {r.slug}: {r.detail}", flush=True)
    return ok_slugs


def phase_reprocess_slugs(slugs: list[str]) -> None:
    if not slugs:
        return
    print(f"Phase 3: re-extract + LLM repair for {len(slugs)} document(s)…", flush=True)
    py = sys.executable
    for slug in slugs:
        print(f"  → process {slug}", flush=True)
        subprocess.run(
            [py, str(ROOT / "scripts" / "ingest.py"), "process", "--slug", slug, "--llm-repair"],
            cwd=ROOT,
            check=False,
        )


def main() -> int:
    parser = argparse.ArgumentParser(description="Reprocess unfixed physics problems")
    parser.add_argument("--skip-clean", action="store_true")
    parser.add_argument("--skip-symbol", action="store_true")
    parser.add_argument("--skip-marker", action="store_true")
    parser.add_argument("--marker-all-unfixed", action="store_true", help="Re-Marker every unfixed PDF")
    parser.add_argument(
        "--marker-symbol-pdfs",
        action="store_true",
        help="Re-Marker PDFs that still have symbol/blank-slot errors after clean/LLM",
    )
    parser.add_argument("--marker-timeout", type=float, default=7200.0)
    parser.add_argument("--no-sync", action="store_true")
    args = parser.parse_args()

    paths = PipelinePaths.resolve(ROOT)
    targets = _load_unfixed(paths)
    if not targets:
        print("No unfixed problems.")
        return 0

    still = targets
    clean_fixed = 0
    if not args.skip_clean:
        clean_fixed, still = phase_heuristic_clean(paths, targets)

    sym_fixed = sym_failed = 0
    if not args.skip_symbol and still:
        sym_fixed, sym_failed, still = phase_symbol_restore(paths, still)

    marker_slugs: set[str] = set()
    for rec in still:
        codes = {e.code for e in rec.errors}
        if args.marker_all_unfixed:
            marker_slugs.add(rec.document_slug)
        elif "expected_image_missing" in codes:
            marker_slugs.add(rec.document_slug)
        elif args.marker_symbol_pdfs and codes & {
            "blank_variable_slot",
            "missing_symbol_after_noun",
        }:
            marker_slugs.add(rec.document_slug)

    reprocessed: list[str] = []
    if not args.skip_marker and marker_slugs:
        reprocessed = phase_marker_reconvert(paths, marker_slugs, timeout_s=args.marker_timeout)
        phase_reprocess_slugs(reprocessed)

    if not args.no_sync:
        print("Phase 4: repair images + sync catalog + export…", flush=True)
        subprocess.run([sys.executable, str(ROOT / "scripts" / "repair_images.py")], cwd=ROOT, check=False)
        subprocess.run([sys.executable, str(ROOT / "scripts" / "sync_catalog.py")], cwd=ROOT, check=False)
        subprocess.run(["node", str(ROOT / "scripts" / "export-static-data.mjs")], cwd=ROOT, check=False)

    gold = load_jsonl(paths.gold_problems_path, lenient=True)
    remaining = [r for r in gold if r.errors]
    _save_unfixed(paths, remaining)

    print(
        json.dumps(
            {
                "heuristic_clean_fixed": clean_fixed,
                "symbol_fixed": sym_fixed,
                "symbol_failed": sym_failed,
                "marker_reconverted": reprocessed,
                "still_unfixed": len(remaining),
            },
            indent=2,
        ),
        flush=True,
    )
    return 0 if not remaining else 1


if __name__ == "__main__":
    raise SystemExit(main())
