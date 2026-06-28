"""Normalize physics markdown for pdflatex / PDF export."""

from __future__ import annotations

import re
import unicodedata

MATH_PART_RE = re.compile(r"(\$\$[\s\S]*?\$\$|\$[^$]+?\$)")

# Unicode → LaTeX command (used inside math; prose wraps with $...$).
MATH_UNICODE: tuple[tuple[str, str], ...] = (
    ("α", r"\alpha"),
    ("β", r"\beta"),
    ("γ", r"\gamma"),
    ("δ", r"\delta"),
    ("ε", r"\epsilon"),
    ("η", r"\eta"),
    ("θ", r"\theta"),
    ("μ", r"\mu"),
    ("µ", r"\mu"),
    ("ν", r"\nu"),
    ("ξ", r"\xi"),
    ("π", r"\pi"),
    ("ρ", r"\rho"),
    ("φ", r"\phi"),
    ("ω", r"\omega"),
    ("ū", r"\hat{u}"),
    ("Ū", r"\hat{U}"),
    ("Δ", r"\Delta"),
    ("Φ", r"\Phi"),
    ("Ω", r"\Omega"),
    ("ℎ", "h"),
    ("ℓ", r"\ell"),
    ("°", r"^{\circ}"),
    ("∘", r"^{\circ}"),
    ("±", r"\pm"),
    ("×", r"\times"),
    ("·", r"\cdot"),
    ("≈", r"\approx"),
    ("≠", r"\neq"),
    ("≤", r"\leq"),
    ("≥", r"\geq"),
    ("≪", r"\ll"),
    ("≫", r"\gg"),
    ("⋯", r"\cdots"),
    ("∞", r"\infty"),
    ("→", r"\rightarrow"),
    ("−", "-"),
    ("²", "^{2}"),
    ("³", "^{3}"),
    ("₁", "_1"),
    ("₂", "_2"),
    ("₃", "_3"),
    ("ᵢ", "_i"),
    ("ₖ", "_k"),
    ("ₘ", "_m"),
    ("ₙ", "_n"),
    ("ₚ", "_p"),
    ("ₛ", "_s"),
    ("ₐ", "_a"),
    ("…", r"\ldots"),
    ("√", r"\sqrt{}"),
    ("′", "'"),
    ("–", "-"),
    ("—", "-"),
    ("⃗", r"\vec{}"),
)


def fix_literal_unicode_escapes(text: str) -> str:
    """Decode literal \\u0394 sequences stored as text instead of real Unicode."""
    return re.sub(
        r"\\u([0-9a-fA-F]{4})",
        lambda m: chr(int(m.group(1), 16)),
        text,
    )

TAB_COMMAND_FIXES: tuple[tuple[str, str], ...] = (
    ("heta", r"\theta"),
    ("ext{", r"\text{"),
    ("au", r"\tau"),
    ("imes", r"\times"),
    ("an", r"\tan"),
    ("an(", r"\tan("),
)

GREEK_IN_TEXT = re.compile(
    r"\\text\{(\\(?:alpha|beta|gamma|delta|epsilon|eta|theta|mu|nu|xi|pi|rho|phi|omega|Delta|Phi|Omega))\}"
)
TEXT_CMD_RE = re.compile(r"\\text\{([^}]*)\}")


def _normalize_text_commands(segment: str) -> str:
    def repl(match: re.Match[str]) -> str:
        body = _map_unicode_to_latex(match.group(1)).strip()
        if re.fullmatch(r"(\\[A-Za-z]+\s*)+", body):
            return body
        if re.fullmatch(r"\\[A-Za-z]+", body):
            return body
        return f"\\text{{{body}}}"

    return TEXT_CMD_RE.sub(repl, segment)


def fix_degree_markers(text: str) -> str:
    text = re.sub(r"\$(\d+)\^°\$", r"$\1^{\\circ}$", text)
    text = text.replace("^°", "^{\\circ}")
    return text


def fix_ll_corruption(text: str) -> str:
    """Repair `$\\ll$` mangled as `$` + newline + `n` (JSON `\\n` swallowing a backslash)."""
    text = text.replace("\\nn", "\\ll")
    text = re.sub(r"(\$[^\n$]*)\n\s*n(\s)", r"\1 \\ll \2", text)
    return text


def fix_rho_corruption(text: str) -> str:
    """Repair $\\rho$ stored as `$` + CR/LF + `ho` (JSON `\\rho` → Python `\\r` + `ho`)."""
    text = (
        text.replace("\x0crho", "\\rho")
        .replace("\r" + "ho", "\\rho")
    )
    # read_text() may convert lone CR to LF before we see it
    text = re.sub(r"\$[\r\n]\s*ho([^$]*?\$)", r"$\\rho\1", text)
    text = re.sub(r"\$\s+ho(?=[,$\s)])", r"$\\rho$", text)
    return text


def fix_json_control_artifacts(text: str) -> str:
    text = (
        text.replace("\x08oldsymbol{", "\\boldsymbol{")
        .replace("\x09ext{", "\\text{")
        .replace("\x0crac{", "\\frac{")
        .replace("\u2009", " ")
        .replace("\u00a0", " ")
    )
    text = fix_rho_corruption(text)
    text = fix_ll_corruption(text)
    text = re.sub(r"\x08(?=[a-zA-Z])", r"\\b", text)
    for suffix, cmd in TAB_COMMAND_FIXES:
        text = text.replace("\t" + suffix, cmd)
    text = re.sub(r"(?<!\$)\$rac\{", r"$\\frac{", text)
    return text


def fix_html_markup(text: str) -> str:
    text = re.sub(
        r"<sup>([^<]+)</sup>",
        lambda m: f"$^{{{_strip_html_inner(m.group(1))}}}$",
        text,
        flags=re.IGNORECASE,
    )
    text = re.sub(
        r"<sub>([^<]+)</sub>",
        lambda m: f"$_{{{_strip_html_inner(m.group(1))}}}$",
        text,
        flags=re.IGNORECASE,
    )
    return text


def _strip_html_inner(value: str) -> str:
    return value.strip()


def _map_unicode_to_latex(value: str) -> str:
    for uni, latex in MATH_UNICODE:
        value = value.replace(uni, latex)
    return value


def _fix_latex_math_commands(segment: str) -> str:
    segment = re.sub(
        r"\\(alpha|beta|gamma|delta|epsilon|eta|theta|mu|nu|xi|pi|rho|phi|omega|Delta|Phi|Omega)(?=[A-Za-z])",
        r"\\\1 ",
        segment,
    )
    segment = re.sub(r"\\text\{sin\}", r"\\sin", segment, flags=re.IGNORECASE)
    segment = re.sub(r"\\text\{cos\}", r"\\cos", segment, flags=re.IGNORECASE)
    segment = re.sub(r"\\text\{tan\}", r"\\tan", segment, flags=re.IGNORECASE)
    return segment


def _fix_dollar_caret_block(match: re.Match[str], text: str) -> str:
    inner = _map_unicode_to_latex(match.group(1).strip())
    before = text[: match.start()].rstrip()

    if inner in {"0", r"\circ"} and before and before[-1].isdigit():
        return r"$^{\circ}$"

    if inner.isdigit():
        unit_tail = before[-1:] if before else ""
        if unit_tail in {"/", "m", "s", "g", "k", "N", "J", "W", "H", "V", "A", "L"}:
            return f"$^{{{inner}}}$"
        if len(before) >= 2 and before[-2:] in {"/s", "m/", "g/"}:
            return f"$^{{{inner}}}$"

    if len(inner) <= 3 and not inner.startswith("{"):
        return f"$_{{{inner}}}$"

    return f"$^{{{inner}}}$"


def fix_dollar_caret_math(text: str) -> str:
    return re.sub(
        r"\$\^(?!\{)([^$]+)\$",
        lambda m: _fix_dollar_caret_block(m, text),
        text,
    )


def fix_unbraced_inline_exponents(text: str) -> str:
    return re.sub(r"\$\^([^{][^$]*)\$", r"$^{\1}$", text)


def fix_empty_display_math(text: str) -> str:
    return re.sub(r"\$\$\s*\$\$", "", text)


def _normalize_math_segment(segment: str) -> str:
    # Strip inline delimiters; display $$...$$ is handled as a single segment.
    display = segment.startswith("$$") and segment.endswith("$$")
    if display:
        inner = segment[2:-2]
    elif segment.startswith("$") and segment.endswith("$"):
        inner = segment[1:-1]
    else:
        inner = segment

    inner = _map_unicode_to_latex(inner)
    inner = _fix_latex_math_commands(inner)
    inner = _normalize_text_commands(inner)
    inner = GREEK_IN_TEXT.sub(r"\1", inner)
    inner = re.sub(r"(?<![\\$])\^(?!\{)([A-Za-z0-9])", r"^{\1}", inner)
    inner = re.sub(r"(?<!\\)_([A-Za-z0-9])", r"_{\1}", inner)

    if display:
        return f"$${inner}$$"
    if segment.startswith("$") and segment.endswith("$"):
        return f"${inner}$"
    return inner


def _normalize_prose_segment(segment: str) -> str:
    segment = unicodedata.normalize("NFC", segment)
    segment = re.sub(r"([A-Za-z])⃗", r"$\\vec{\1}$", segment)
    segment = re.sub(r"([A-Za-z])\u0302", r"$\\hat{\1}$", segment)
    for uni, latex in MATH_UNICODE:
        segment = segment.replace(uni, f"${latex}$")
    segment = "".join(c for c in segment if unicodedata.category(c) != "Mn")
    return segment


def _split_and_map(text: str) -> str:
    parts = MATH_PART_RE.split(text)
    out: list[str] = []
    for index, part in enumerate(parts):
        if index % 2 == 1:
            out.append(_normalize_math_segment(part))
        else:
            out.append(_normalize_prose_segment(part))
    return "".join(out)


def fix_unclosed_inline_math(text: str) -> str:
    """Close `$v_2.` style math where the trailing `$` was lost."""
    return re.sub(
        r"(?<![A-Za-z0-9\\])\$([^$\n]{0,40}?[_^][A-Za-z0-9]+)([.!?;:])(?!\$)",
        r"$\1$\2",
        text,
    )


def strip_combining_marks(text: str) -> str:
    return "".join(c for c in text if unicodedata.category(c) != "Mn")


def normalize_for_latex(text: str) -> str:
    """Apply all markdown → LaTeX-safe normalization passes."""
    text = fix_json_control_artifacts(text)
    text = fix_literal_unicode_escapes(text)
    text = fix_degree_markers(text)
    text = fix_html_markup(text)
    text = fix_empty_display_math(text)
    text = fix_dollar_caret_math(text)
    text = fix_unclosed_inline_math(text)
    text = _split_and_map(text)
    text = fix_unbraced_inline_exponents(text)
    return strip_combining_marks(text)
