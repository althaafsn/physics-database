from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from src.paths import PipelinePaths
from src.repair_images import pick_best_diagram, repair_record_images, strip_watermark_refs
from src.schema import ProblemSource, ProblemRecord


SOURCE = ProblemSource(pdf="x.pdf", md="x.md", meta_json="x_meta.json")


def test_pick_best_diagram_prefers_high_index(tmp_path: Path):
  folder = tmp_path / "bronze"
  folder.mkdir()
  (folder / "_page_1_Picture_0.jpeg").write_bytes(b"x" * 4000)
  (folder / "_page_1_Picture_1.jpeg").write_bytes(b"x" * 3500)
  (folder / "_page_1_Picture_16.jpeg").write_bytes(b"x" * 10000)
  assert pick_best_diagram(folder, {1}) == "_page_1_Picture_16.jpeg"


def test_strip_watermark_refs_removes_publisher_triplet():
  raw = (
    "Soal katrol.\n\n"
    "![](_page_5_Picture_0.jpeg)\n\n"
    "![](_page_5_Picture_1.jpeg)\n\n"
    "![](_page_5_Picture_4.jpeg)\n"
  )
  cleaned = strip_watermark_refs(raw)
  assert "Picture_0" not in cleaned
  assert "Soal katrol." in cleaned


def test_repair_record_images_attaches_diagram(tmp_path: Path):
  paths = PipelinePaths.resolve(ROOT)
  folder = tmp_path / "Soal OSK Fisika SMA 2019"
  folder.mkdir()
  md = folder / "Soal OSK Fisika SMA 2019.md"
  md.write_text("# test\n", encoding="utf-8")
  (folder / "_page_1_Picture_0.jpeg").write_bytes(b"x" * 4000)
  (folder / "_page_1_Picture_1.jpeg").write_bytes(b"x" * 3500)
  (folder / "_page_1_Picture_16.jpeg").write_bytes(b"x" * 10000)

  record = ProblemRecord(
    id="OSK-2019-02",
    document_slug="Soal OSK Fisika SMA 2019",
    level="OSK",
    year=2019,
    problem_number=2,
    title="Silinder",
    topic="mechanics",
    topic_confidence=1.0,
    body_md=(
      "Silinder di pinggir meja (lihat gambar).\n\n"
      "![](_page_1_Picture_0.jpeg)\n\n"
      "![](_page_1_Picture_1.jpeg)\n\n"
      "![](_page_1_Picture_4.jpeg)"
    ),
    source=ProblemSource(
      pdf=str(tmp_path / "x.pdf"),
      md=str(md),
      meta_json="",
    ),
  )

  assets = tmp_path / "assets"
  assets.mkdir()
  changed = repair_record_images(record, folder, assets)
  assert changed
  assert len(record.images) == 1
  assert record.images[0].filename == "_page_1_Picture_16.jpeg"
  assert "_page_1_Picture_16.jpeg" in record.body_md
  assert "Picture_0" not in record.body_md
