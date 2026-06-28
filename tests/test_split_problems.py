from __future__ import annotations

import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from src.split_problems import (
    chunk_problem_segments,
    detect_split_strategy,
    extract_subparts,
    split_markdown_auto,
    split_markdown_inline_numbered,
    split_problems_from_folder,
)

OUTPUT = ROOT / "output"


@pytest.fixture
def osk_2003():
    return OUTPUT / "Soal OSK Fisika SMA 2003"


@pytest.fixture
def osn_2018():
    return OUTPUT / "Soal OSN Fisika SMA 2018"


def test_split_osk_2003(osk_2003):
    if not osk_2003.is_dir():
        pytest.skip("OSK 2003 fixture not converted yet")
    problems = split_problems_from_folder(osk_2003)
    assert len(problems) == 7
    assert problems[0].problem_number == 1
    assert "Dimensi" in problems[0].title
    assert problems[0].body_md.strip()
    assert "![](_page_" in problems[1].body_md or problems[1].problem_number == 2


def test_split_osn_2018(osn_2018):
    if not osn_2018.is_dir():
        pytest.skip("OSN 2018 fixture not converted yet")
    problems = split_problems_from_folder(osn_2018)
    assert len(problems) >= 3
    assert problems[0].problem_number == 1
    assert "Domino" in problems[0].title


def test_extract_subparts():
    body = "Intro\n\n(a) First part\n\n(b) Second part"
    parts = extract_subparts(body)
    labels = [p["label"] for p in parts]
    assert "a" in labels
    assert "b" in labels


def test_split_inline_numbered():
    md = "Intro\n\n1) First problem text here.\n\n2) Second problem."
    problems = split_markdown_inline_numbered(md)
    assert len(problems) == 2
    assert problems[0][0] == 1
    assert "First problem" in problems[0][2]


def test_chunk_problem_segments():
    segments = [(i, f"title {i}", f"body {i}") for i in range(1, 21)]
    chunks = chunk_problem_segments(segments, chunk_size=8)
    assert len(chunks) == 3
    assert len(chunks[0]) == 8
    assert len(chunks[1]) == 8
    assert len(chunks[2]) == 4


@pytest.fixture
def osk_2026():
    return OUTPUT / "Soal OSK Fisika SMA 2026"


@pytest.fixture
def osk_2020():
    return OUTPUT / "Soal OSK Fisika SMA 2020"


@pytest.fixture
def osk_2012():
    return OUTPUT / "Soal OSK Fisika SMA 2012"


def test_split_osk_2026_inline(osk_2026):
    if not osk_2026.is_dir():
        pytest.skip("OSK 2026 fixture not converted yet")
    problems = split_problems_from_folder(osk_2026)
    assert len(problems) == 20
    assert problems[0].problem_number == 1
    assert problems[-1].problem_number == 20


def test_split_osk_2020_section_titled(osk_2020):
    if not osk_2020.is_dir():
        pytest.skip("OSK 2020 fixture not converted yet")
    problems = split_problems_from_folder(osk_2020)
    assert len(problems) >= 6
    assert problems[0].problem_number == 1
    assert "Kesetimbangan" in problems[0].title or "parabola" in problems[0].title.lower()


def test_split_osk_2012_variants(osk_2012):
    if not osk_2012.is_dir():
        pytest.skip("OSK 2012 fixture not converted yet")
    problems = split_problems_from_folder(osk_2012)
    assert len(problems) == 24
    variants = {p.variant for p in problems}
    assert variants == {1, 2, 3}
    ids = {(p.variant, p.problem_number) for p in problems}
    assert len(ids) == 24


def test_detect_split_strategy_inline():
    md = "1) foo\n2) bar"
    assert detect_split_strategy(md, year=2026) == "inline_numbered"


def test_split_markdown_auto_chunks_long_inline():
    lines = [f"{i}) Problem number {i} with some text.\n" for i in range(1, 16)]
    md = "\n".join(lines)
    problems = split_markdown_auto(md, year=2026, chunk_size=8)
    assert len(problems) == 15
    assert problems[0][0] == 1
    assert problems[-1][0] == 15
