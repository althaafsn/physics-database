from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from src.pdf_export import markdown_to_latex_document, normalize_math_markdown


def test_normalize_corrupted_boldsymbol():
    text = "Value $\x08oldsymbol{Q}$ here"
    fixed = normalize_math_markdown(text)
    assert "\\boldsymbol{Q}" in fixed


def test_normalize_unicode_mu_inside_math():
    text = "Coefficient $ μ_1 $ and plain μ symbol"
    fixed = normalize_math_markdown(text)
    assert "\\mu_{1}" in fixed
    assert "$\\mu$" in fixed


def test_normalize_unicode_eta_in_text():
    text = r"Viskositas $\boldsymbol{\text{η}}$"
    fixed = normalize_math_markdown(text)
    assert r"\boldsymbol{\eta}" in fixed
    assert r"\text{\eta}" not in fixed


def test_normalize_unicode_delta_in_prose():
    text = "selama Δ = 1,2 detik"
    fixed = normalize_math_markdown(text)
    assert r"$\Delta$" in fixed


def test_markdown_to_latex_includes_math():
    md = "# Title\n\nInline $x^2$ and display:\n\n$$E=mc^2$$\n"
    tex = markdown_to_latex_document(md, resource_dir=Path("/tmp"), engine="pdflatex")
    assert "\\section*{Title}" in tex
    assert "$x^{2}$" in tex
    assert "E=mc^{2}" in tex
