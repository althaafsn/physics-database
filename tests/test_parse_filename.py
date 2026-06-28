from __future__ import annotations

import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from src.parse_filename import parse_pdf_filename


@pytest.mark.parametrize(
    "filename,level,year,round_name,variant",
    [
        ("Soal OSK Fisika SMA 2015.pdf", "OSK", 2015, None, None),
        ("Soal OSN Fisika SMA 2018.pdf", "OSN", 2018, None, None),
        ("Soal OSK Fisika SMA 2023 (1).pdf", "OSK", 2023, None, 1),
        ("Soal OSN Fisika SMA Final 2025.pdf", "OSN", 2025, "final", None),
        ("Soal OSP Fisika SMA 2025 + Semifinal.pdf", "OSP", 2025, "semifinal", None),
    ],
)
def test_parse_pdf_filename(filename, level, year, round_name, variant):
    meta = parse_pdf_filename(filename)
    assert meta.level == level
    assert meta.year == year
    assert meta.round == round_name
    assert meta.variant == variant


def test_parse_pdf_filename_invalid():
    meta = parse_pdf_filename("not-a-valid-name.pdf")
    assert meta.slug == "not-a-valid-name"
    assert meta.meta_source == "filename_fallback"
    assert meta.level is None
