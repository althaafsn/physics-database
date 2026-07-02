#!/usr/bin/env python3
"""Ingest all_pdf/solutions/*.pdf into parsed/solutions/solutions.jsonl.

Pipeline per PDF: doc-type filter -> Marker (typed) or vision transcription
(handwriting) -> split into per-problem segments -> align to gold problem_id
-> safety gate -> SolutionRecord.
"""
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

from src.bronze_convert import convert_pdf_to_bronze, marker_extra_args_from_env
from src.paths import PipelinePaths
from src.record_store import load_jsonl
from src.solutions.align import AlignResult, GoldIndex, align_solution
from src.solutions.classify_doc_type import classify_doc_type
from src.solutions.filename_meta import parse_solution_filename
from src.solutions.safety_gate import solution_passes_safety_gate
from src.solutions.schema import SkippedSolutionDoc, SolutionRecord, SolutionSource
from src.solutions.split import split_solution_markdown
from src.solutions.store import (
    load_solutions,
    save_solutions,
    solutions_bronze_dir,
    solutions_jsonl_path,
)
from src.solutions.vision_transcribe import transcribe_pdf


def _log(msg: str) -> None:
    print(msg, flush=True)


def _typed_markdown(pdf_path: Path, bronze_dir: Path, *, force: bool) -> tuple[str, str | None]:
    slug = pdf_path.stem
    md_path = bronze_dir / slug / f"{slug}.md"
    if force or not md_path.is_file():
        result = convert_pdf_to_bronze(
            pdf_path,
            bronze_dir=bronze_dir,
            marker_extra_args=marker_extra_args_from_env(),
            # CPU Marker conversion is documented (scripts/convert_pending_cpu.sh)
            # to take ~15-45 min per PDF; default generously above that.
            timeout_s=float(os.environ.get("MARKER_TIMEOUT_S", "5400")),
        )
        if not result.ok:
            return "", result.detail
    if not md_path.is_file():
        return "", "marker produced no markdown"
    return md_path.read_text(encoding="utf-8"), None


def ingest_one(
    pdf_path: Path,
    *,
    gold_index: GoldIndex,
    bronze_dir: Path,
    force: bool,
) -> tuple[list[SolutionRecord], SkippedSolutionDoc | None]:
    meta = parse_solution_filename(pdf_path.name)
    _log(f"[{pdf_path.name}] level={meta.level} year={meta.year} handwriting={meta.is_handwriting}")

    method = "typed"
    md_text = ""
    if not meta.is_handwriting:
        md_text, error = _typed_markdown(pdf_path, bronze_dir, force=force)
        if error:
            return [], SkippedSolutionDoc(pdf=str(pdf_path), reason="marker_failed", detail=error)

    needs_vision = meta.is_handwriting or len(md_text.split()) < 30
    if needs_vision:
        method = "handwriting_vision"
        md_text, insufficient = transcribe_pdf(pdf_path, log=_log)
        if insufficient:
            return [], SkippedSolutionDoc(
                pdf=str(pdf_path),
                reason="vision_model_insufficient",
                detail=(
                    f"SOLUTION_VISION_MODEL={os.environ.get('SOLUTION_VISION_MODEL', 'moondream')} "
                    "could not reliably transcribe this scanned/handwritten PDF - needs a stronger "
                    "vision-capable model before this document can be ingested"
                ),
            )
        if not md_text.strip():
            return [], SkippedSolutionDoc(
                pdf=str(pdf_path), reason="vision_transcription_empty", detail="no legible pages"
            )

    doc_type = classify_doc_type(pdf_path.name, md_text)
    if not doc_type.is_solution:
        return [], SkippedSolutionDoc(
            pdf=str(pdf_path),
            reason="not_a_solution_document",
            detail=doc_type.reason,
        )

    segments = split_solution_markdown(md_text)
    if not segments:
        return [], SkippedSolutionDoc(
            pdf=str(pdf_path), reason="split_failed", detail="no confident numbered segments found"
        )

    records: list[SolutionRecord] = []
    for problem_number, body in segments:
        ok, gate_reason = solution_passes_safety_gate(body)
        result: AlignResult = align_solution(
            gold_index,
            level=meta.level,
            year=meta.year,
            problem_number=problem_number,
            variant_hint=meta.variant_hint,
            round_hint=meta.round_hint,
        )
        if result.problem_id is None:
            continue  # no_match: nothing to align this segment to, drop silently

        errors: list[str] = []
        flags = list(result.flags)
        if not ok:
            errors.append(gate_reason or "safety_gate_rejected")

        records.append(
            SolutionRecord(
                problem_id=result.problem_id,
                document_slug=meta.slug,
                level=meta.level,
                year=meta.year,
                solution_number=problem_number,
                body_md=body if ok else "",
                method=method,
                source=SolutionSource(pdf=str(pdf_path.resolve())),
                alignment_method=result.method,
                alignment_confidence=result.confidence,
                flags=flags,
                errors=errors,
                llm_model=None,
            )
        )
    return records, None


def main() -> int:
    parser = argparse.ArgumentParser(description="Ingest worked-solution PDFs")
    parser.add_argument("--limit", type=int, default=None, help="Only process first N PDFs")
    parser.add_argument("--only", type=str, default=None, help="Comma-separated PDF filenames")
    parser.add_argument("--force", action="store_true", help="Re-run Marker even if bronze exists")
    args = parser.parse_args()

    paths = PipelinePaths.resolve(ROOT)
    solutions_dir = ROOT / "all_pdf" / "solutions"
    bronze_dir = solutions_bronze_dir(ROOT)
    bronze_dir.mkdir(parents=True, exist_ok=True)

    gold_records = load_jsonl(paths.gold_problems_path, lenient=True)
    gold_index = GoldIndex(gold_records)
    _log(f"Loaded {len(gold_records)} gold problems for alignment")

    pdfs = sorted(solutions_dir.glob("*.pdf"))
    if args.only:
        wanted = {name.strip() for name in args.only.split(",") if name.strip()}
        pdfs = [p for p in pdfs if p.name in wanted]
    if args.limit is not None:
        pdfs = pdfs[: args.limit]

    _log(f"Found {len(pdfs)} solution PDFs to process")

    out_path = solutions_jsonl_path(paths.parsed_dir)
    skipped_path = out_path.parent / "skipped.jsonl"
    out_path.parent.mkdir(parents=True, exist_ok=True)

    # CPU Marker conversion can take tens of minutes per PDF (documented in
    # scripts/convert_pending_cpu.sh) - persist after EVERY document instead
    # of only at the end, so a long batch run is resumable and partial
    # progress is usable immediately by downstream steps.
    existing_all = load_solutions(out_path)
    existing_skipped = (
        [json_line for json_line in skipped_path.read_text(encoding="utf-8").splitlines() if json_line.strip()]
        if skipped_path.is_file()
        else []
    )

    def _persist(new_records: list[SolutionRecord], touched_pdf: Path, skip: SkippedSolutionDoc | None) -> None:
        nonlocal existing_all, existing_skipped
        touched_key = str(touched_pdf.resolve())
        existing_all = [r for r in existing_all if r.source.pdf != touched_key] + new_records
        save_solutions(out_path, existing_all)
        if skip is not None:
            existing_skipped = [
                line for line in existing_skipped if json.loads(line).get("pdf") != str(touched_pdf)
            ]
            existing_skipped.append(skip.model_dump_json())
            skipped_path.write_text("\n".join(existing_skipped) + "\n", encoding="utf-8")

    total_new = 0
    total_skipped = 0
    for i, pdf_path in enumerate(pdfs, start=1):
        _log(f"\n=== [{i}/{len(pdfs)}] {pdf_path.name} ===")
        try:
            records, skip = ingest_one(pdf_path, gold_index=gold_index, bronze_dir=bronze_dir, force=args.force)
        except Exception as exc:  # noqa: BLE001 - keep batch going on a single bad PDF
            _log(f"  ✗ unexpected error: {exc}")
            skip = SkippedSolutionDoc(pdf=str(pdf_path), reason="exception", detail=str(exc))
            records = []
        if skip:
            _log(f"  skipped: {skip.reason} ({skip.detail})")
            total_skipped += 1
        else:
            aligned = sum(1 for r in records if r.alignment_method == "exact")
            ambiguous = sum(1 for r in records if r.alignment_method == "ambiguous")
            rejected = sum(1 for r in records if r.errors)
            _log(f"  -> {len(records)} solutions ({aligned} exact, {ambiguous} ambiguous, {rejected} gate-rejected)")
            total_new += len(records)
        _persist(records, pdf_path, skip)
        _log(f"  [checkpoint saved -> {out_path}]")

    review_count = sum(1 for r in existing_all if r.needs_review)
    _log(
        f"\nDone. {total_new} new solution records this run "
        f"({len(existing_all)} total in {out_path}, {review_count} flagged for review)\n"
        f"  {total_skipped} PDFs skipped this run -> {skipped_path}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
