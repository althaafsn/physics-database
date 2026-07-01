from __future__ import annotations

import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from src.schema import ProblemRecord, ProblemSource, SubPart
from src.validate import apply_validation, validate_record, validate_text

SOURCE = ProblemSource(pdf="x.pdf", md="x.md", meta_json="x_meta.json")


def _record(body_md: str, **kwargs) -> ProblemRecord:
    defaults = {
        "id": "TEST-2000-01",
        "document_slug": "Test Document",
        "level": "OSK",
        "year": 2000,
        "problem_number": 1,
        "title": "Test",
        "topic": "mechanics",
        "topic_confidence": 1.0,
        "body_md": body_md,
        "source": SOURCE,
    }
    defaults.update(kwargs)
    return ProblemRecord(**defaults)


def test_osk_2003_01_missing_symbols():
    body = (
        "Anggap bahwa volume cairan yang mengalir tiap detik adalah ̇, yang melalui suatu "
        "tabung silinder tergantung pada gradien tekanan ′ , jari-jari tabung , dan "
        "koefisien viskositas cairan . Gunakan metode dimensi untuk menemukan rumus untuk "
        "dalam suku , , dan . Diketahui satuan viskositas adalah kg/ms, satuan gradien "
        "tekanan ′ adalah N/m<sup>3</sup> , dan satuan ̇ adalah m<sup>3</sup> /det."
    )
    issues = validate_text(body)
    codes = {issue.code for issue in issues}
    assert "blank_variable_slot" in codes
    assert "html_math_markup" in codes


def test_osk_2005_01_blank_slots():
    body = (
        "Menurut kerangka acuan (, ), titik T mempunyai koordinat (, ). "
        "Tentukan koordinat titik T menurut kerangka acuan (, ). "
        "Nyatakan dalam , , dan ."
    )
    issues = validate_text(body)
    codes = {issue.code for issue in issues}
    assert "blank_variable_slot" in codes


def test_osn_2012_05_footer():
    body = (
        "Soal kapasitor.\n\n"
        "Dimensi Sains - Ahmad Basyir Najwan\n\n"
        "www.basyiralbanjari.wordpress.com | Youtube: Dimensi Sains"
    )
    issues = validate_text(body)
    codes = {issue.code for issue in issues}
    assert "footer_contamination" in codes


def test_osk_2005_02_clean():
    body = "Dapatkah laju sebuah benda bertambah, jika percepatannya berkurang? Jelaskan."
    issues = validate_text(body)
    assert issues == []


def test_missing_g_constant():
    body = "Gunakan percepatan gravitasi = 10 m/s 2 ."
    issues = validate_text(body)
    assert any(issue.code == "missing_g_constant" for issue in issues)


def test_missing_symbol_false_positive_when_symbol_present():
    body = "Jika periode rotasinya $T$, tentukan besar sudut $\\theta$."
    issues = validate_text(body)
    assert not any(issue.code == "missing_symbol_after_noun" for issue in issues)

    body2 = "Anggap percepatan gravitasi adalah $g$ = 10 m/s²."
    issues2 = validate_text(body2)
    assert not any(issue.code == "missing_symbol_after_noun" for issue in issues2)


def test_missing_symbol_still_flags_blank_quantity():
    body = "Bidang miring dapat bergerak dan bermassa = 2 kg."
    issues = validate_text(body)
    assert any(issue.code == "missing_symbol_after_noun" for issue in issues)


def test_apply_validation_sets_body_md_raw():
    record = _record("Gunakan percepatan gravitasi = 10 m/s 2 .")
    apply_validation(record)
    assert record.body_md_raw == record.body_md
    assert any(issue.code == "missing_g_constant" for issue in record.errors)
    assert "missing_g_constant" in record.flags


def test_validate_record_checks_subparts():
    record = _record(
        "Intro",
        subparts=[SubPart(label="a", text="Nyatakan dalam , , dan .")],
    )
    issues = validate_record(record)
    assert any(issue.code == "blank_variable_slot" for issue in issues)
