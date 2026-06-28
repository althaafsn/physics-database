from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from src.pdf_export import _escape_outside_math


def test_bold_markdown_becomes_latex_command():
    line = "**Petunjuk:** gunakan rumus"
    escaped = _escape_outside_math(line)
    assert r"\textbf{Petunjuk:}" in escaped
    assert "textbackslash" not in escaped


def test_italic_markdown_becomes_latex_command():
    line = "jurnal *Physical Review Letters* (2019)"
    escaped = _escape_outside_math(line)
    assert r"\textit{Physical Review Letters}" in escaped
    assert "textbackslash" not in escaped
