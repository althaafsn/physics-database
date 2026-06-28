from __future__ import annotations

import json
import shutil
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from src.paths import PipelinePaths
from src.problem_set import ProblemSetFilters, build_problem_set


@pytest.mark.slow
def test_export_full_catalog_pdf(tmp_path: Path):
    if shutil.which("pdflatex") is None:
        pytest.skip("pdflatex not installed")

    catalog = ROOT / "parsed" / "catalog" / "problems.jsonl"
    if not catalog.is_file():
        pytest.skip("catalog missing")

    ids = [json.loads(line)["id"] for line in catalog.read_text(encoding="utf-8").splitlines()]
    paths = PipelinePaths.resolve(ROOT)
    result = build_problem_set(
        paths,
        name="catalog-all",
        filters=ProblemSetFilters(),
        ids=ids,
        write_markdown=True,
        write_json=False,
        write_pdf=True,
        output_dir=tmp_path,
    )
    assert result.pdf_error is None, result.pdf_error
    assert result.pdf_path is not None
    assert result.pdf_path.stat().st_size > 10_000
