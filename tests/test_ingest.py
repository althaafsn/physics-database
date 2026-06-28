from __future__ import annotations

import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from src.parse_filename import parse_document, parse_pdf_filename
from src.record_store import merge_records
from src.schema import MetadataOverrides, ProblemRecord, ProblemSource


SOURCE = ProblemSource(pdf="/data/all_pdf/custom.pdf", md="/data/out/custom/custom.md", meta_json="")


def test_parse_generic_filename():
    meta = parse_pdf_filename("OSN_2022_mechanics_set.pdf", base_dir="/data/all_pdf")
    assert meta.level == "OSN"
    assert meta.year == 2022
    assert meta.meta_source == "filename_generic"


def test_parse_document_from_markdown_title():
    md = "# **Soal OSK Fisika SMA 2027**\n\n1) A particle moves..."
    meta = parse_document(
        "custom_scan",
        pdf_dir=Path("/data/all_pdf"),
        md_text=md,
    )
    assert meta.level == "OSK"
    assert meta.year == 2027
    assert meta.meta_source == "markdown_title"


def test_parse_document_cli_override():
    meta = parse_document(
        "mystery.pdf",
        pdf_dir=Path("/data/all_pdf"),
        overrides=MetadataOverrides(level="OSP", year=2019),
    )
    assert meta.level == "OSP"
    assert meta.year == 2019
    assert meta.meta_source == "cli_override"


def test_merge_records_replaces_one_source():
    old = ProblemRecord(
        id="OSK-2020-01",
        document_slug="Soal OSK Fisika SMA 2020",
        level="OSK",
        year=2020,
        problem_number=1,
        title="Old",
        topic="mechanics",
        topic_confidence=1.0,
        body_md="old",
        source=ProblemSource(pdf="/data/a.pdf", md="a.md", meta_json=""),
    )
    other = ProblemRecord(
        id="OSK-2021-01",
        document_slug="Soal OSK Fisika SMA 2021",
        level="OSK",
        year=2021,
        problem_number=1,
        title="Keep",
        topic="mechanics",
        topic_confidence=1.0,
        body_md="keep",
        source=ProblemSource(pdf="/data/b.pdf", md="b.md", meta_json=""),
    )
    new = ProblemRecord(
        id="OSK-2020-01",
        document_slug="Soal OSK Fisika SMA 2020",
        level="OSK",
        year=2020,
        problem_number=1,
        title="New",
        topic="mechanics",
        topic_confidence=1.0,
        body_md="new",
        source=ProblemSource(pdf="/data/a.pdf", md="a2.md", meta_json=""),
    )
    merged = merge_records([old, other], [new], replace_source_pdfs={"/data/a.pdf"}, replace_slugs={"Soal OSK Fisika SMA 2020"})
    assert len(merged) == 2
    by_id = {r.id: r for r in merged}
    assert by_id["OSK-2020-01"].body_md == "new"
    assert by_id["OSK-2021-01"].body_md == "keep"
