from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from src.clean import clean_record, clean_text
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
