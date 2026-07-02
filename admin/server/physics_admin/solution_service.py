"""Load verified solutions and serve progressive hint chunks."""
from __future__ import annotations

from physics_admin.schemas import SolutionHintsResponse
from physics_admin.tutor_context import _load_solutions_by_id
from src.solutions.hints import split_solution_into_hints


def solution_available(problem_id: str) -> bool:
    return problem_id in _load_solutions_by_id()


def get_solution_hints(
    problem_id: str,
    *,
    through: int | None,
    include_full: bool,
) -> SolutionHintsResponse | None:
    solution = _load_solutions_by_id().get(problem_id)
    if solution is None:
        return None

    hints_all = split_solution_into_hints(solution.body_md)
    total = len(hints_all)

    revealed: list[str] = []
    if through is not None:
        end = min(through, total - 1)
        revealed = hints_all[: end + 1]

    full_md = solution.body_md if include_full else None

    return SolutionHintsResponse(
        problem_id=problem_id,
        available=True,
        total_hints=total,
        hints=revealed,
        full_markdown=full_md,
    )
