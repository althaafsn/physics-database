from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from src.catalog import is_catalog_eligible, sync_catalog
from src.paths import PipelinePaths
from src.schema import ProblemRecord, ProblemSource, ValidationIssue


SOURCE = ProblemSource(pdf="/data/x.pdf", md="/data/x.md", meta_json="")


def _record(**kwargs) -> ProblemRecord:
    defaults = dict(
        id="OSK-2020-01",
        document_slug="Soal OSK Fisika SMA 2020",
        level="OSK",
        year=2020,
        problem_number=1,
        title="Test",
        topic="mechanics",
        topic_confidence=0.9,
        body_md="body",
        source=SOURCE,
    )
    defaults.update(kwargs)
    return ProblemRecord(**defaults)


def test_is_catalog_eligible_rejects_errors_and_low_confidence():
    assert is_catalog_eligible(_record())
    assert not is_catalog_eligible(_record(errors=[ValidationIssue(code="x", message="bad")]))
    assert not is_catalog_eligible(_record(topic="mixed", topic_confidence=0.9))
    assert not is_catalog_eligible(_record(topic_confidence=0.5))


def test_sync_catalog_writes_eligible_only(tmp_path):
    paths = PipelinePaths(
        root=tmp_path,
        pdf_dir=tmp_path / "all_pdf",
        bronze_dir=tmp_path / "output",
        parsed_dir=tmp_path / "parsed",
    )
    paths.ensure_dirs()

    gold = [
        _record(id="A"),
        _record(id="B", errors=[ValidationIssue(code="x", message="bad")]),
        _record(id="C", topic_confidence=0.4),
    ]
    from src.record_store import save_jsonl

    save_jsonl(paths.gold_problems_path, gold)
    meta = sync_catalog(paths)

    assert meta["catalog_total"] == 1
    catalog = json.loads(paths.catalog_problems_path.read_text(encoding="utf-8").splitlines()[0])
    assert catalog["id"] == "A"
    manifest = json.loads(paths.catalog_manifest_path.read_text())
    assert manifest["gold_total"] == 3
    assert manifest["excluded_errors"] == 1
