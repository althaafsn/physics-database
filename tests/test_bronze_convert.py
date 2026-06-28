from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from src.bronze_convert import is_bronze_ready, list_pending_marker_pdfs
from src.paths import PipelinePaths


def test_list_pending_marker_pdfs_skips_existing_bronze(tmp_path: Path):
    pdf_dir = tmp_path / "all_pdf"
    bronze_dir = tmp_path / "output"
    parsed_dir = tmp_path / "parsed"
    pdf_dir.mkdir()
    bronze_dir.mkdir()
    parsed_dir.mkdir()

    slug = "Soal OSK Fisika SMA 2099"
    (pdf_dir / f"{slug}.pdf").write_bytes(b"%PDF-1.4")
    (pdf_dir / "Soal OSK Fisika SMA 2100.pdf").write_bytes(b"%PDF-1.4")

    folder = bronze_dir / slug
    folder.mkdir()
    (folder / f"{slug}.md").write_text("# Done\n", encoding="utf-8")

    paths = PipelinePaths(
        root=tmp_path,
        pdf_dir=pdf_dir,
        bronze_dir=bronze_dir,
        parsed_dir=parsed_dir,
    )

    assert is_bronze_ready(paths, slug) is True
    pending = list_pending_marker_pdfs(paths)
    assert [item[0] for item in pending] == ["Soal OSK Fisika SMA 2100"]
