from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from src.schema import ProblemRecord, ProblemSource
from src.solutions.align import GoldIndex, align_solution
from src.solutions.classify_doc_type import classify_doc_type
from src.solutions.filename_meta import parse_solution_filename
from src.solutions.safety_gate import solution_passes_safety_gate
from src.solutions.schema import SolutionRecord, SolutionSource
from src.solutions.split import split_solution_markdown
from src.solutions.store import solution_status_by_problem_id


def _rec(id: str, level: str, year: int, problem_number: int, variant: int | None = None, round: str | None = None) -> ProblemRecord:
    return ProblemRecord(
        id=id,
        document_slug=f"{level}-{year}",
        level=level,
        year=year,
        round=round,
        variant=variant,
        problem_number=problem_number,
        title="t",
        topic="mechanics",
        topic_confidence=0.9,
        body_md="body",
        source=ProblemSource(pdf="x.pdf", md="x.md", meta_json=""),
    )


def test_parse_solution_filename_basic():
    meta = parse_solution_filename("osk-fisika-2012-tipe-a-solusi.pdf")
    assert meta.level == "OSK"
    assert meta.year == 2012
    assert meta.variant_hint == "a"
    assert meta.is_handwriting is False


def test_parse_solution_filename_handwriting():
    meta = parse_solution_filename("solusi-osn-fisika-sma-final-2025-handwriting.pdf")
    assert meta.level == "OSN"
    assert meta.year == 2025
    assert meta.round_hint == "final"
    assert meta.is_handwriting is True


def test_split_solution_markdown_dash_numbering():
    text = "1- (nilai 10) First solution text here with enough words to pass gates.\n2- (nilai 5) Second solution text also long enough.\n3- (nilai 5) Third one."
    segments = split_solution_markdown(text)
    assert [n for n, _ in segments] == [1, 2, 3]
    assert "First solution" in segments[0][1]


def test_split_solution_markdown_marker_headings():
    text = (
        "## **1- Jawab:**\n"
        "First solution with enough words to pass safety gates easily here.\n"
        "2- Second problem starts here with enough words for the gate.\n"
        "- 3- Jawab:\n"
        "Third solution segment also long enough for safety gates."
    )
    segments = split_solution_markdown(text)
    assert [n for n, _ in segments] == [1, 2, 3]


def test_split_solution_markdown_no_numbering_returns_empty():
    assert split_solution_markdown("just some prose with no numbers at all") == []


def test_split_solution_markdown_number_heading():
    text = (
        "## OSK Fisika 2014 Number 1\n"
        "First solution with enough words to pass safety gates easily here.\n"
        "## OSK Fisika 2014 Number 2\n"
        "Second solution segment also long enough for safety gates."
    )
    segments = split_solution_markdown(text)
    assert [n for n, _ in segments] == [1, 2]


def test_split_solution_markdown_implicit_first_when_numbering_starts_at_two():
    text = (
        "Jawaban Soal OSK FISIKA 2014\n"
        "First problem answer without an explicit one marker but long enough here.\n"
        "2. (10 poin) Second problem starts here with enough words for the gate.\n"
        "4. (12 poin) Fourth problem because third is missing in this scan."
    )
    segments = split_solution_markdown(text)
    assert [n for n, _ in segments] == [1, 2, 4]


def test_split_solution_into_hints_subparts():
    from src.solutions.hints import split_solution_into_hints

    text = (
        "Intro paragraph explaining the overall approach with enough words here.\n\n"
        "a- First subpart answer with sufficient detail for students to learn.\n\n"
        "b- Second subpart continues the derivation with more math steps shown.\n\n"
        "c- Final subpart wraps up with the numeric result for the problem."
    )
    hints = split_solution_into_hints(text)
    assert len(hints) >= 3
    assert hints[0].startswith("Intro")
    assert hints[1].startswith("a-")


def test_align_exact_match():
    index = GoldIndex([_rec("OSK-2014-01", "OSK", 2014, 1)])
    result = align_solution(index, level="OSK", year=2014, problem_number=1, variant_hint=None, round_hint=None)
    assert result.problem_id == "OSK-2014-01"
    assert result.method == "exact"
    assert result.confidence == 1.0


def test_align_no_match():
    index = GoldIndex([_rec("OSK-2014-01", "OSK", 2014, 1)])
    result = align_solution(index, level="OSK", year=2099, problem_number=1, variant_hint=None, round_hint=None)
    assert result.problem_id is None
    assert result.method == "no_match"


def test_align_ambiguous_variant_disambiguates():
    index = GoldIndex(
        [
            _rec("OSK-2012-v1-01", "OSK", 2012, 1, variant=1),
            _rec("OSK-2012-v2-01", "OSK", 2012, 1, variant=2),
        ]
    )
    result = align_solution(index, level="OSK", year=2012, problem_number=1, variant_hint="b", round_hint=None)
    assert result.problem_id == "OSK-2012-v2-01"
    assert result.method == "exact"


def test_align_ambiguous_flags_for_review():
    index = GoldIndex(
        [
            _rec("OSK-2012-v1-01", "OSK", 2012, 1, variant=1),
            _rec("OSK-2012-v2-01", "OSK", 2012, 1, variant=2),
        ]
    )
    result = align_solution(index, level="OSK", year=2012, problem_number=1, variant_hint=None, round_hint=None)
    assert result.method == "ambiguous"
    assert "alignment_review_required" in result.flags


def test_safety_gate_rejects_short_body():
    ok, reason = solution_passes_safety_gate("too short")
    assert ok is False
    assert reason


def test_safety_gate_accepts_real_solution():
    body = "Menggunakan hukum kekekalan energi, kita dapatkan $v = \\sqrt{2gh}$ sehingga kecepatannya adalah 5 m/s."
    ok, reason = solution_passes_safety_gate(body)
    assert ok is True
    assert reason is None


def test_classify_doc_type_rejects_bare_exam_paper():
    text = "PETUNJUK TES TERTULIS TEORI:\nTuliskan Nomor Peserta Anda. Waktu : 3 Jam\n1. Tentukan kecepatan benda."
    result = classify_doc_type("osn-fisika-2011.pdf", text)
    assert result.is_solution is False


def test_classify_doc_type_accepts_repeated_pembahasan():
    text = "\n".join([f"{i}. Soal.\nPembahasan: langkah demi langkah menuju jawaban." for i in range(1, 4)])
    result = classify_doc_type("osk-fisika-2014.pdf", text)
    assert result.is_solution is True


def _solution(problem_id: str, *, errors: list[str] | None = None) -> SolutionRecord:
    return SolutionRecord(
        problem_id=problem_id,
        document_slug="doc",
        solution_number=1,
        body_md="body",
        source=SolutionSource(pdf="x.pdf"),
        errors=errors or [],
    )


def test_solution_status_verified_when_no_issues():
    status = solution_status_by_problem_id([_solution("OSK-2014-01")])
    assert status == {"OSK-2014-01": "verified"}


def test_solution_status_needs_review_when_any_segment_flagged():
    records = [_solution("OSK-2014-01"), _solution("OSK-2014-01", errors=["safety_gate_rejected"])]
    status = solution_status_by_problem_id(records)
    assert status == {"OSK-2014-01": "needs_review"}


def test_solution_status_absent_problem_not_in_dict():
    status = solution_status_by_problem_id([_solution("OSK-2014-01")])
    assert "OSK-2099-01" not in status
