"""Split a worked-solution markdown document into per-problem segments.

Solution documents number problems more loosely than the main corpus (e.g.
``1- (nilai 10) ...``, ``1. ...``, ``No. 1 ...``), so this is a dedicated,
more permissive splitter rather than reusing src/split_problems.py's
problem-statement-oriented regexes.
"""
from __future__ import annotations

import re

# Matches a new-problem marker at the start of a line: "1- ", "1. ", "1) ",
# "No 1", "No. 1", "Soal 1", "Soal nomor 1" - all commonly seen across the 71
# solution PDFs from different authors/years.
_NUMBERED_LINE_RE = re.compile(
    r"^(?:no\.?\s*|soal\s*(?:nomor\s*)?)?(?P<num>\d{1,2})[.\-)]\s+",
    re.IGNORECASE | re.MULTILINE,
)


def split_solution_markdown(md_text: str) -> list[tuple[int, str]]:
    """Return [(problem_number, body_md), ...] in document order.

    Only accepts a strictly increasing (or restarting-at-1, for multi-part
    docs) sequence of small numbers to avoid false positives from equation
    lines that happen to start with a digit (e.g. "2. 5 m/s" continuing a
    derivation) - a real new-problem marker is expected to appear at roughly
    similar cadence, so we require the numbers to look like 1, 2, 3, ...
    """
    matches = list(_NUMBERED_LINE_RE.finditer(md_text))
    if not matches:
        return []

    candidates: list[tuple[int, int, int]] = []  # (start_pos, end_pos, number)
    for i, m in enumerate(matches):
        candidates.append((m.start(), m.end(), int(m.group("num"))))

    accepted: list[tuple[int, int, int]] = []
    expected_next = 1
    for start, end, num in candidates:
        if num == expected_next or (not accepted and num == 1):
            accepted.append((start, end, num))
            expected_next = num + 1
        elif num == 1 and accepted and accepted[-1][2] >= expected_next - 1:
            # A second numbered section starting over at 1 (e.g. separate
            # "tipe A" / "tipe B" blocks within one PDF) - keep it, but do not
            # merge problem numbers across the restart boundary.
            accepted.append((start, end, num))
            expected_next = 2

    if len(accepted) < 2:
        # Too few confident matches to trust a structured split - caller
        # should fall back to treating the whole doc as unsplit / low
        # confidence rather than guessing.
        return []

    segments: list[tuple[int, str]] = []
    for i, (start, _end, num) in enumerate(accepted):
        body_start = accepted[i][1]
        body_end = accepted[i + 1][0] if i + 1 < len(accepted) else len(md_text)
        body = md_text[body_start:body_end].strip()
        if body:
            segments.append((num, body))
    return segments
