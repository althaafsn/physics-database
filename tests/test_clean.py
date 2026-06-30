from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from src.clean import clean_record, clean_text, strip_duplicate_subparts
from src.schema import ProblemRecord, ProblemSource, SubPart
from src.validate import validate_record


SOURCE = ProblemSource(pdf="x.pdf", md="x.md", meta_json="x_meta.json")


def test_clean_text_removes_footer_and_watermarks():
    raw = (
        "Hitung jaraknya.\n\n"
        "![](_page_2_Picture_0.jpeg)\n\n"
        "Dimensi Sains - Ahmad Basyir Najwan\n\n"
        "www.basyiralbanjari.wordpress.com | Youtube: Dimensi Sains\n\n"
        "Instagram: dimensisains.official | WA: 089659856821/085217499402\n\n"
        "![](_page_2_Picture_4.jpeg)\n"
    )
    cleaned = clean_text(raw)
    assert "Dimensi Sains" not in cleaned
    assert "dimensisains" not in cleaned
    assert "_Picture_0" not in cleaned
    assert "_Picture_4" not in cleaned
    assert "Hitung jaraknya." in cleaned


def test_clean_text_removes_fzti_block():
    raw = (
        "Soal bandul.\n\n"
        "Program Persiapan OSN Fisika\n"
        "Dibimbing langsung oleh Kak Basyir\n\n"
        "Apa itu FZTI?\n\n"
        "From Zero to Infinity adalah program pelatihan fisika."
    )
    cleaned = clean_text(raw)
    assert cleaned == "Soal bandul."


def test_clean_text_removes_fzti_tail_from_apa_itu():
    raw = (
        "Katapel problem ends here.\n\n"
        "Apa itu FZTI?\n\n"
        "From Zero to Infinity adalah program pelatihan fisika.\n\n"
        "★ Daftar via Google Form bit.ly/DaftarFZTI"
    )
    cleaned = clean_text(raw)
    assert cleaned == "Katapel problem ends here."


def test_clean_text_strips_promo_only_split_sections():
    samples = [
        (
            "OSK-2020-08",
            "- •Siswa SMP Kelas 9 dan SMA Kelas 10-11\n"
            "- •Cocok untuk:\n  - Pemula (belaiar dari nol)",
        ),
        (
            "OSK-2020-09",
            "- · Online & fleksibel\n- · Modul PDF lengkap\n"
            "- Setara meng-khatamkan buku\n   David Morin Classical Mechanics",
        ),
        (
            "OSK-2020-10",
            "Diskusi langsung dengan **Kak Basyir** Grup WA diskusi (*Focus Group*)\n\n"
            "★ Daftar via Google Form bit.ly/DaftarFZTI",
        ),
        (
            "OSK-2020-11",
            "- •Paket I: FZTI OSK\n- •Paket II: LOOF (OSP-OSN)\n"
            "# Unduh Buku **Panduan FZTI** untuk informasi yang lebih lengkap di sini bit.ly/BukuPanduanFZTI",
        ),
        (
            "OSK-2020-12",
            "- •Diskon tambahan Rp100.000\n\n"
            "Ingin mencari teman untuk daftar kolektif? Gabung ke grup WA berikut bit.ly/DaftarKolektifFZTI",
        ),
    ]
    for label, raw in samples:
        cleaned = clean_text(raw)
        assert cleaned == "", f"{label} should clean to empty, got: {cleaned!r}"


def test_clean_record_clears_promo_validation_error():
    record = ProblemRecord(
        id="OSK-2020-11",
        document_slug="Soal OSK Fisika SMA 2020",
        level="OSK",
        year=2020,
        problem_number=11,
        title="Pilihan Paket",
        topic="mixed",
        topic_confidence=0.0,
        body_md="- •Paket I: FZTI OSK\n- •Paket II: LOOF (OSP-OSN)",
        source=SOURCE,
    )
    record.body_md_raw = record.body_md
    before = validate_record(record)
    assert any(e.code == "promo_contamination" for e in before)
    clean_record(record)
    assert record.body_md == ""
    after = validate_record(record)
    assert not any(e.code == "promo_contamination" for e in after)


def test_clean_text_html_and_gravity():
    raw = "Gunakan = 10 m/s<sup>2</sup> . Massa <sup>1</sup> = 1 kg."
    cleaned = clean_text(raw)
    assert "$g = 10$" in cleaned
    assert "<sup>" not in cleaned
    assert "$m_{1}$" in cleaned


def test_clean_record_reextracts_subparts():
    record = ProblemRecord(
        id="OSK-2009-06",
        document_slug="Soal OSK Fisika SMA 2009",
        level="OSK",
        year=2009,
        problem_number=6,
        title="Tumbukan",
        topic="mechanics",
        topic_confidence=1.0,
        body_md=(
            "Intro\n\n(a) Part a\n\nDimensi Sains - Ahmad Basyir Najwan\n\n"
            "Instagram: dimensisains.official | WA: 089659856821/085217499402\n\n"
            "- (b) Part b"
        ),
        source=SOURCE,
        subparts=[
            SubPart(
                label="a",
                text="Part a\n\nDimensi Sains - Ahmad Basyir Najwan",
            )
        ],
    )
    clean_record(record)
    assert "Dimensi Sains" not in record.body_md
    assert all("Dimensi Sains" not in sp.text for sp in record.subparts)
    labels = [sp.label for sp in record.subparts]
    assert "a" in labels
    assert "b" in labels


def _record_with_inline_subparts(**overrides) -> ProblemRecord:
    defaults = dict(
        id="OSK-2003-05",
        document_slug="Soal OSK Fisika SMA 2003",
        level="OSK",
        year=2003,
        problem_number=5,
        title="Bidang miring",
        topic="mechanics",
        topic_confidence=1.0,
        body_md=(
            "Sebuah balok ditarik ke atas bidang miring.\n\n"
            "- (a) Hitung koefisien gesekan balok.\n"
            "- (b) Analisis apa yang terjadi bila gaya nol."
        ),
        source=SOURCE,
        subparts=[
            SubPart(label="a", text="Hitung koefisien gesekan balok."),
            SubPart(label="b", text="Analisis apa yang terjadi bila gaya nol."),
        ],
    )
    defaults.update(overrides)
    return ProblemRecord(**defaults)


def test_strip_duplicate_subparts_removes_inline_block():
    record = _record_with_inline_subparts()
    changed = strip_duplicate_subparts(record)
    assert changed is True
    assert record.body_md == "Sebuah balok ditarik ke atas bidang miring."
    # subparts list is untouched and still carries the questions.
    assert [sp.label for sp in record.subparts] == ["a", "b"]
    assert record.subparts[0].text == "Hitung koefisien gesekan balok."


def test_strip_duplicate_subparts_is_idempotent():
    record = _record_with_inline_subparts()
    assert strip_duplicate_subparts(record) is True
    body_after_first = record.body_md
    assert strip_duplicate_subparts(record) is False
    assert record.body_md == body_after_first


def test_strip_duplicate_subparts_preserves_stem_images():
    record = _record_with_inline_subparts(
        body_md=(
            "Sebuah tongkat bersandar pada dinding.\n\n"
            "![](_page_1_Picture_12.jpeg)\n\n"
            "- (a) Hitung koefisien gesekan balok.\n"
            "- (b) Analisis apa yang terjadi bila gaya nol."
        ),
    )
    assert strip_duplicate_subparts(record) is True
    assert "![](_page_1_Picture_12.jpeg)" in record.body_md
    assert "(a)" not in record.body_md and "(b)" not in record.body_md


def test_strip_duplicate_subparts_noop_without_inline_subparts():
    record = _record_with_inline_subparts(
        body_md="Sebuah balok ditarik ke atas bidang miring.",
    )
    assert strip_duplicate_subparts(record) is False
    assert record.body_md == "Sebuah balok ditarik ke atas bidang miring."


def test_strip_duplicate_subparts_handles_english_variant():
    record = _record_with_inline_subparts(
        body_md_en=(
            "A block is pulled up an incline.\n\n"
            "- (a) Find the coefficient of friction.\n"
            "- (b) Analyse what happens when the force is zero."
        ),
        subparts_en=[
            SubPart(label="a", text="Find the coefficient of friction."),
            SubPart(label="b", text="Analyse what happens when the force is zero."),
        ],
    )
    assert strip_duplicate_subparts(record) is True
    assert record.body_md_en == "A block is pulled up an incline."
    assert [sp.label for sp in record.subparts_en] == ["a", "b"]


def test_clean_record_clears_footer_validation_error():
    record = ProblemRecord(
        id="OSK-2006-04",
        document_slug="Soal OSK Fisika SMA 2006",
        level="OSK",
        year=2006,
        problem_number=4,
        title="Diagram",
        topic="mechanics",
        topic_confidence=1.0,
        body_md=(
            "Sebuah sistem ditunjukkan pada diagram.\n\n"
            "Dimensi Sains – Ahmad Basyir Najwan\n\n"
            "Instagram: dimensisains.official | WA: 089659856821/085217499402"
        ),
        source=SOURCE,
    )
    record.body_md_raw = record.body_md
    before = validate_record(record)
    assert any(e.code == "footer_contamination" for e in before)
    clean_record(record)
    after = validate_record(record)
    assert not any(e.code == "footer_contamination" for e in after)
