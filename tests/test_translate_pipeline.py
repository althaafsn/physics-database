from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from src.schema import ProblemRecord, ProblemSource, ValidationIssue
from src.translate_pipeline import select_records_for_translation

SOURCE = ProblemSource(pdf="x.pdf", md="x.md", meta_json="x_meta.json")


def _record(
    *,
    rec_id: str,
    slug: str,
    translated: bool = False,
    errors: bool = False,
) -> ProblemRecord:
    return ProblemRecord(
        id=rec_id,
        document_slug=slug,
        level="OSK",
        year=2003,
        problem_number=1,
        title="Judul",
        topic="mechanics",
        topic_confidence=1.0,
        body_md="Isi soal.",
        source=SOURCE,
        errors=[ValidationIssue(code="x", message="err")] if errors else [],
        llm_translated=translated,
        body_md_en="Body." if translated else None,
        title_en="Title" if translated else None,
    )


def test_select_records_catalog_only():
    records = [
        _record(rec_id="OSK-2003-01", slug="Soal OSK Fisika SMA 2003"),
        _record(rec_id="OSK-2003-02", slug="Soal OSK Fisika SMA 2003", errors=True),
        _record(rec_id="OSK-2003-03", slug="Soal OSK Fisika SMA 2003", translated=True),
    ]
    selected = select_records_for_translation(records, catalog_only=True)
    assert [r.id for r in selected] == ["OSK-2003-01"]


def test_select_records_by_slug():
    records = [
        _record(rec_id="OSK-2003-01", slug="Soal OSK Fisika SMA 2003"),
        _record(rec_id="OSP-2003-01", slug="Soal OSP Fisika SMA 2003"),
    ]
    selected = select_records_for_translation(
        records,
        slugs={"Soal OSK Fisika SMA 2003"},
        catalog_only=False,
    )
    assert [r.id for r in selected] == ["OSK-2003-01"]
