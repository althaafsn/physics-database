"""Public worked-solution hints API (no login).

Solutions stay server-side; clients receive only the hint chunks they request.
"""
from __future__ import annotations

from fastapi import APIRouter, HTTPException, Query, status

from physics_admin.schemas import SolutionHintsResponse
from physics_admin.solution_service import get_solution_hints, solution_available

router = APIRouter()


@router.get("/problems/{problem_id}/solution", response_model=SolutionHintsResponse)
def problem_solution(
    problem_id: str,
    through: int | None = Query(
        default=None,
        ge=0,
        description="Return hints 0..through inclusive (progressive reveal).",
    ),
    full: bool = Query(default=False, description="Include the full worked solution markdown."),
) -> SolutionHintsResponse:
    if not solution_available(problem_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No solution for this problem")

    payload = get_solution_hints(problem_id, through=through, include_full=full)
    if payload is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="No solution for this problem")
    return payload
