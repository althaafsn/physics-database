from __future__ import annotations

import subprocess
import sys
from pathlib import Path

from physics_admin.config import get_settings
from src.catalog import is_catalog_eligible, sync_catalog
from src.paths import PipelinePaths
from src.record_store import load_jsonl, save_jsonl
from src.schema import ProblemRecord, SubPart
from src.solutions.store import load_solutions, solution_status_by_problem_id, solutions_jsonl_path
from src.validate import apply_validation


def _paths() -> PipelinePaths:
    settings = get_settings()
    return PipelinePaths.resolve(settings.physics_db_root)


def solution_statuses() -> dict[str, str]:
    """problem_id -> "verified" | "needs_review", for problems with at least
    one ingested worked-solution segment. Used by the editor's solutions
    status filter/badge - never exposed to the public reader."""
    path = solutions_jsonl_path(_paths().parsed_dir)
    return solution_status_by_problem_id(load_solutions(path))


def list_problems(
    *,
    q: str | None = None,
    level: str | None = None,
    errors_only: bool = False,
    solution_status: str | None = None,
    limit: int = 200,
    offset: int = 0,
) -> tuple[list[ProblemRecord], int]:
    records = load_jsonl(_paths().gold_problems_path, lenient=True)
    if q:
        needle = q.lower()
        records = [
            r
            for r in records
            if needle in r.id.lower()
            or needle in r.title.lower()
            or needle in r.body_md.lower()
        ]
    if level:
        records = [r for r in records if r.level == level]
    if errors_only:
        records = [r for r in records if r.errors]
    if solution_status:
        statuses = solution_statuses()
        if solution_status == "none":
            records = [r for r in records if r.id not in statuses]
        else:
            records = [r for r in records if statuses.get(r.id) == solution_status]
    total = len(records)
    return records[offset : offset + limit], total


def get_problem(problem_id: str) -> ProblemRecord | None:
    for rec in load_jsonl(_paths().gold_problems_path, lenient=True):
        if rec.id == problem_id:
            return rec
    return None


def update_problem(problem_id: str, updates: dict) -> ProblemRecord:
    paths = _paths()
    records = load_jsonl(paths.gold_problems_path, lenient=True)
    found: ProblemRecord | None = None
    for i, rec in enumerate(records):
        if rec.id != problem_id:
            continue
        data = rec.model_dump()
        for key, value in updates.items():
            if value is None:
                continue
            if key in {"subparts", "subparts_en"}:
                data[key] = [SubPart(**sp).model_dump() for sp in value]
            else:
                data[key] = value
        found = apply_validation(ProblemRecord(**data))
        records[i] = found
        break

    if found is None:
        raise KeyError(problem_id)

    save_jsonl(paths.gold_problems_path, records)
    sync_catalog(paths)
    return found


def publish_static() -> dict:
    paths = _paths()
    meta = sync_catalog(paths)
    root = paths.root
    subprocess.run(
        ["npm", "run", "export:data"],
        cwd=root,
        check=True,
        capture_output=True,
        text=True,
    )
    return {
        "gold_total": int(meta["gold_total"]),
        "catalog_total": int(meta["catalog_total"]),
        "exported": True,
    }
