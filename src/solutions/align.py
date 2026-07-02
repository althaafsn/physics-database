"""Align a solved problem_number from a solution document to a gold
problem_id, via level + year (+ variant/round hints), matching the
make_problem_id() scheme in src/pipeline.py. Ambiguous/low-confidence
alignments are flagged rather than silently guessed."""
from __future__ import annotations

from collections import defaultdict
from dataclasses import dataclass

from src.schema import ProblemRecord

_VARIANT_LETTER_TO_INT = {"a": 1, "b": 2, "c": 3}


@dataclass(frozen=True)
class AlignResult:
    problem_id: str | None
    method: str  # "exact" | "ambiguous" | "no_match"
    confidence: float
    flags: tuple[str, ...] = ()


class GoldIndex:
    """Groups gold ProblemRecords by (level, year, problem_number) for fast
    alignment lookups."""

    def __init__(self, records: list[ProblemRecord]) -> None:
        self._by_key: dict[tuple[str | None, int | None, int], list[ProblemRecord]] = defaultdict(list)
        for rec in records:
            self._by_key[(rec.level, rec.year, rec.problem_number)].append(rec)

    def candidates(self, level: str | None, year: int | None, problem_number: int) -> list[ProblemRecord]:
        return self._by_key.get((level, year, problem_number), [])


def align_solution(
    index: GoldIndex,
    *,
    level: str | None,
    year: int | None,
    problem_number: int,
    variant_hint: str | None,
    round_hint: str | None,
) -> AlignResult:
    candidates = index.candidates(level, year, problem_number)

    if not candidates:
        return AlignResult(None, "no_match", 0.0, ("no_gold_match",))

    if len(candidates) == 1:
        return AlignResult(candidates[0].id, "exact", 1.0)

    # Multiple gold records share (level, year, problem_number) - usually
    # distinct variants (tipe A/B/C) or rounds (final/semifinal). Try to
    # disambiguate with hints parsed from the solution filename.
    if variant_hint:
        wanted_variant = _VARIANT_LETTER_TO_INT.get(variant_hint.lower())
        if wanted_variant is not None:
            matches = [c for c in candidates if c.variant == wanted_variant]
            if len(matches) == 1:
                return AlignResult(matches[0].id, "exact", 0.9)

    if round_hint:
        matches = [c for c in candidates if c.round == round_hint]
        if len(matches) == 1:
            return AlignResult(matches[0].id, "exact", 0.9)

    # Still ambiguous: pick the lowest-id candidate as a best-effort guess,
    # but flag it loudly for human review instead of guessing silently.
    best_guess = sorted(candidates, key=lambda c: c.id)[0]
    return AlignResult(
        best_guess.id,
        "ambiguous",
        0.4,
        ("alignment_review_required", f"ambiguous_among:{','.join(sorted(c.id for c in candidates))}"),
    )
