from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from src.problem_set import (
    ProblemSetFilters,
    build_problem_set,
    filter_problems,
    render_markdown,
    select_problems,
)
from src.paths import PipelinePaths
from src.schema import ProblemRecord, ProblemSource


SOURCE = ProblemSource(pdf="/data/x.pdf", md="/data/x.md", meta_json="")


def _record(
    *,
    id: str,
    level: str = "OSK",
    year: int = 2020,
    topic: str = "mechanics",
    errors: list | None = None,
) -> ProblemRecord:
    return ProblemRecord(
        id=id,
        document_slug="Soal OSK Fisika SMA 2020",
        level=level,
        year=year,
        problem_number=1,
        title=f"Problem {id}",
        topic=topic,
        topic_confidence=1.0,
        body_md="Massa = 1 kg.",
        source=SOURCE,
        errors=errors or [],
    )


def test_filter_clean_only():
    records = [
        _record(id="A", errors=[]),
        _record(id="B", errors=[{"code": "x", "message": "y", "snippet": None}]),
    ]
    filters = ProblemSetFilters(clean_only=True)
    assert [r.id for r in filter_problems(records, filters)] == ["A"]


def test_filter_level_topic_year():
    records = [
        _record(id="A", level="OSK", year=2020, topic="mechanics"),
        _record(id="B", level="OSP", year=2020, topic="mechanics"),
        _record(id="C", level="OSK", year=2019, topic="electromagnetism"),
    ]
    filters = ProblemSetFilters(levels=["OSK"], years=[2020], topics=["mechanics"])
    assert [r.id for r in filter_problems(records, filters)] == ["A"]


def test_select_by_ids_and_count():
    records = [_record(id=f"P{i}") for i in range(5)]
    picked = select_problems(records, ids=["P1", "P3"])
    assert [r.id for r in picked] == ["P1", "P3"]
    sample = select_problems(records, count=2, seed=7)
    assert len(sample) == 2


def test_render_markdown_includes_title_and_id():
    rec = _record(id="OSK-2020-01")
    text = render_markdown([rec], title="Latihan OSK")
    assert "# Latihan OSK" in text
    assert "OSK-2020-01" in text
    assert "Problem OSK-2020-01" in text


def test_build_problem_set_integration(tmp_path: Path):
    parsed = tmp_path / "parsed"
    gold_dir = parsed / "gold"
    gold_dir.mkdir(parents=True)
    rec = _record(id="OSK-2020-01")
    gold_dir.joinpath("problems.jsonl").write_text(
        json.dumps(rec.model_dump(), ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    paths = PipelinePaths(
        root=tmp_path,
        pdf_dir=tmp_path / "all_pdf",
        bronze_dir=tmp_path / "output",
        parsed_dir=parsed,
    )
    result = build_problem_set(
        paths,
        name="demo-set",
        filters=ProblemSetFilters(clean_only=True, levels=["OSK"]),
        use_gold=True,
        write_pdf=False,
    )
    assert result.manifest_path is not None
    assert result.markdown_path is not None
    assert result.manifest_path.is_file()
    assert result.markdown_path.is_file()
    manifest = json.loads(result.manifest_path.read_text(encoding="utf-8"))
    assert manifest["problem_ids"] == ["OSK-2020-01"]
