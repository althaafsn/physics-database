from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from src.math_normalize import normalize_for_latex


def test_fix_boldsymbol_control_char():
    text = "Value $\x08oldsymbol{Q}$ here"
    fixed = normalize_for_latex(text)
    assert "\\boldsymbol{Q}" in fixed


def test_fix_frac_form_feed():
    text = "Inersia $ " + "\x0c" + "rac{2}{5}mR^2 $"
    fixed = normalize_for_latex(text)
    assert r"\frac{2}{5}" in fixed


def test_fix_dollar_caret_subscript():
    text = "kecepatan sudut $^1$ dan $^2$"
    fixed = normalize_for_latex(text)
    assert "$_{1}$" in fixed
    assert "$_{2}$" in fixed


def test_fix_dollar_caret_degree():
    text = "sudut $^0$ = 45$^0$"
    fixed = normalize_for_latex(text)
    assert "$_{0}$" in fixed
    assert r"$^{\circ}$" in fixed


def test_fix_dollar_caret_unit_exponent():
    text = "Gunakan $g = 10$ m/s$^2$ dan N/m$^3$"
    fixed = normalize_for_latex(text)
    assert "$^{2}$" in fixed
    assert "$^{3}$" in fixed


def test_fix_unicode_h_force():
    text = "gaya horizontal $^ℎ$ yang besarnya"
    fixed = normalize_for_latex(text)
    assert "$_{h}$" in fixed
    assert "$^" not in fixed or "$_{h}$" in fixed


def test_fix_unicode_delta_in_prose():
    text = "selama Δ = 1,2 detik"
    fixed = normalize_for_latex(text)
    assert r"$\Delta$" in fixed


def test_fix_unicode_eta_in_text():
    text = r"Viskositas $\boldsymbol{\text{η}}$"
    fixed = normalize_for_latex(text)
    assert r"\boldsymbol{\eta}" in fixed


def test_fix_html_sup():
    text = "kecepatan awal <sup>0</sup> = 7 m/s"
    fixed = normalize_for_latex(text)
    assert "$^{0}$" in fixed


def test_fix_ll_newline_corruption():
    text = "assume $R \n" + "n r$ and $m \n" + "n m_1$"
    fixed = normalize_for_latex(text)
    assert r"\ll" in fixed
    assert "\n" + "n r" not in fixed


def test_fix_markdown_bold_in_prose():
    text = "Soal **Momentum Linear** tentang gaya"
    fixed = normalize_for_latex(text)
    assert "**Momentum Linear**" in fixed


def test_fix_rho_carriage_return():
    text = "variabel $" + "\r" + "ho$, $g$"
    fixed = normalize_for_latex(text)
    assert r"$\rho$" in fixed
    assert "$ ho$" not in fixed


def test_fix_rho_universal_newline():
    text = "massa $" + "\n" + "ho g$, dimana $" + "\n" + "ho$ adalah"
    fixed = normalize_for_latex(text)
    assert r"$\rho g$" in fixed
    assert r"$\rho$" in fixed


def test_fix_omega_followed_by_t():
    text = r"$x(t) = A \text{sin}(\omega t + \phi)$"
    fixed = normalize_for_latex(text.replace("omega", "ω").replace("phi", "φ"))
    assert r"\omega t" in fixed or r"\omega  t" in fixed
    assert r"\omegat" not in fixed
    assert r"\sin" in fixed


def test_catalog_normalization_has_no_control_chars():
    catalog = ROOT / "parsed" / "catalog" / "problems.jsonl"
    if not catalog.is_file():
        return
    ctrl = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f]")
    bare_caret = re.compile(r"\$\^[^{]")
    for line in catalog.read_text(encoding="utf-8").splitlines():
        rec = json.loads(line)
        blob = rec.get("body_md", "")
        for sp in rec.get("subparts", []):
            blob += "\n" + sp.get("text", "")
        fixed = normalize_for_latex(blob)
        assert not ctrl.search(fixed), rec["id"]
        assert not bare_caret.search(fixed), rec["id"]
