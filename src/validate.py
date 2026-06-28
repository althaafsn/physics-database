from __future__ import annotations

import re

from src.schema import ProblemRecord, SubPart, ValidationIssue

from src.clean import FOOTER_INLINE_RE, PROMO_CONTAMINATION_RE
BLANK_SLOT_RE = re.compile(
    r"\(\s*,\s*\)|,\s*,\s*|dalam\s+,\s*,\s*dan|Nyatakan dalam\s+,\s*,\s*dan",
    re.IGNORECASE,
)
MISSING_SYMBOL_NOUN_RE = re.compile(
    r"(?<![\w$\\])"
    r"(?:massa|kecepatan|sudut|periode|gravitasi|bermassa|jari-jari|konstanta)"
    r"\s+(?:=|adalah|rotasinya|,|\.)",
    re.IGNORECASE,
)
MISSING_G_RE = re.compile(r"=\s*10\s*m/s\s*2", re.IGNORECASE)
ORPHAN_SUPERSCRIPT_RE = re.compile(
    r"(?:bermassa|konstanta pegas|kecepatan|partikel|balok|pegas|massa)\s*<sup>",
    re.IGNORECASE,
)
HTML_MATH_RE = re.compile(r"<su[bp]>", re.IGNORECASE)


def _snippet(text: str, match: re.Match[str], width: int = 60) -> str:
    start = max(0, match.start() - width // 2)
    end = min(len(text), match.end() + width // 2)
    return text[start:end].replace("\n", " ").strip()


def _has_g_symbol(text: str, pos: int) -> bool:
    prefix = text[max(0, pos - 30) : pos]
    return bool(re.search(r"\$g\$|\bg\s*=|\bg\s", prefix))


def _issues_from_text(text: str) -> list[ValidationIssue]:
    issues: list[ValidationIssue] = []

    for match in FOOTER_INLINE_RE.finditer(text):
        issues.append(
            ValidationIssue(
                code="footer_contamination",
                message="Promotional footer or contact text detected",
                snippet=_snippet(text, match),
            )
        )
        break

    for match in PROMO_CONTAMINATION_RE.finditer(text):
        issues.append(
            ValidationIssue(
                code="promo_contamination",
                message="FZTI or course signup promotional text detected",
                snippet=_snippet(text, match),
            )
        )
        break

    for match in BLANK_SLOT_RE.finditer(text):
        issues.append(
            ValidationIssue(
                code="blank_variable_slot",
                message="Blank variable slot detected in problem text",
                snippet=_snippet(text, match),
            )
        )
        break

    for match in MISSING_SYMBOL_NOUN_RE.finditer(text):
        issues.append(
            ValidationIssue(
                code="missing_symbol_after_noun",
                message="Physics quantity appears without its symbol",
                snippet=_snippet(text, match),
            )
        )
        break

    for match in MISSING_G_RE.finditer(text):
        if not _has_g_symbol(text, match.start()):
            issues.append(
                ValidationIssue(
                    code="missing_g_constant",
                    message="Gravitational acceleration written without g symbol",
                    snippet=_snippet(text, match),
                )
            )
            break

    for match in ORPHAN_SUPERSCRIPT_RE.finditer(text):
        issues.append(
            ValidationIssue(
                code="orphan_superscript",
                message="Superscript without base variable detected",
                snippet=_snippet(text, match),
            )
        )
        break

    if HTML_MATH_RE.search(text):
        match = HTML_MATH_RE.search(text)
        assert match is not None
        issues.append(
            ValidationIssue(
                code="html_math_markup",
                message="HTML sup/sub markup should be LaTeX math",
                snippet=_snippet(text, match),
            )
        )

    return issues


def _issues_from_flags(flags: list[str]) -> list[ValidationIssue]:
    issues: list[ValidationIssue] = []
    for flag in flags:
        if flag.startswith("missing_image:"):
            issues.append(
                ValidationIssue(
                    code="missing_image",
                    message=f"Referenced image not found: {flag.split(':', 1)[1]}",
                    snippet=flag,
                )
            )
        elif flag == "expected_image_missing":
            issues.append(
                ValidationIssue(
                    code="expected_image_missing",
                    message="Problem text references a diagram but no image is attached",
                    snippet=None,
                )
            )
    return issues


def _dedupe_issues(issues: list[ValidationIssue]) -> list[ValidationIssue]:
    seen: set[str] = set()
    unique: list[ValidationIssue] = []
    for issue in issues:
        if issue.code in seen:
            continue
        seen.add(issue.code)
        unique.append(issue)
    return unique


def validate_text(text: str, *, flags: list[str] | None = None) -> list[ValidationIssue]:
    issues = _issues_from_text(text)
    if flags:
        issues.extend(_issues_from_flags(flags))
    return _dedupe_issues(issues)


def validate_record(record: ProblemRecord) -> list[ValidationIssue]:
    """Return deterministic parse errors for a problem record."""
    texts = [record.body_md]
    texts.extend(sp.text for sp in record.subparts)
    issues: list[ValidationIssue] = []
    for text in texts:
        issues.extend(_issues_from_text(text))
    issues.extend(_issues_from_flags(record.flags))
    return _dedupe_issues(issues)


def sync_flags_from_errors(errors: list[ValidationIssue], attach_flags: list[str]) -> list[str]:
    """Mirror error codes into flags while preserving attach-specific flags."""
    codes = {issue.code for issue in errors}
    flags = list(attach_flags)
    for code in codes:
        if code not in flags:
            flags.append(code)
    return flags


def apply_validation(record: ProblemRecord) -> ProblemRecord:
    """Populate body_md_raw, errors, and flags on a record."""
    if record.body_md_raw is None:
        record.body_md_raw = record.body_md
    attach_flags = [
        f for f in record.flags if f.startswith("missing_image:") or f == "expected_image_missing"
    ]
    record.errors = validate_record(record)
    record.flags = sync_flags_from_errors(record.errors, attach_flags)
    return record
