"""Builds the AI tutor's grounded system prompt.

Given only a problem_id from the client, loads the canonical problem text,
the real stored solution (if any), and prerequisite-graph neighbors
server-side - the client's own `problem.title`/`body`/`parts` are NEVER
trusted for grounding, only used as a display-context fallback when the id
doesn't resolve to a known gold problem.
"""
from __future__ import annotations

import json
import time
from pathlib import Path

from physics_admin.config import get_settings
from src.paths import PipelinePaths
from src.record_store import load_jsonl
from src.schema import ProblemRecord
from src.solutions.store import load_solutions, solutions_by_problem_id, solutions_jsonl_path

_CACHE_TTL_S = 60.0
_cache: dict[str, tuple[float, object]] = {}


def _paths() -> PipelinePaths:
    settings = get_settings()
    return PipelinePaths.resolve(settings.physics_db_root)


def _cached(key: str, loader):
    now = time.monotonic()
    hit = _cache.get(key)
    if hit is not None and now - hit[0] < _CACHE_TTL_S:
        return hit[1]
    value = loader()
    _cache[key] = (now, value)
    return value


def _load_problems_by_id() -> dict[str, ProblemRecord]:
    def loader():
        records = load_jsonl(_paths().gold_problems_path, lenient=True)
        return {r.id: r for r in records}

    return _cached("problems", loader)


def _load_solutions_by_id() -> dict[str, object]:
    def loader():
        path = solutions_jsonl_path(_paths().parsed_dir)
        records = load_solutions(path)
        usable = [r for r in records if not r.needs_review]
        return solutions_by_problem_id(usable)

    return _cached("solutions", loader)


def _load_prerequisites_by_id() -> dict[str, dict]:
    def loader():
        path = _paths().parsed_dir / "graph" / "prerequisites.jsonl"
        if not path.is_file():
            return {}
        out: dict[str, dict] = {}
        for line in path.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if not line:
                continue
            data = json.loads(line)
            out[data["problem_id"]] = data
        return out

    return _cached("prerequisites", loader)


BASE_SYSTEM_PROMPT = """You are a friendly, rigorous physics tutor for students preparing for \
Indonesian physics olympiads (OSK/OSP/OSN) and general physics courses.

Core rules:
- Default to Socratic, progressive hints: point at the relevant concept/equation and the \
first step, then let the student attempt it. Only give the complete step-by-step walkthrough \
if the student explicitly asks for the full solution/answer, or after they've tried and are \
still stuck across a couple of exchanges.
- Stay strictly grounded in the CONTEXT provided below (the problem statement, and the stored \
solution if present). Never invent numeric answers or derivation steps that are not supported \
by that context.
- If no verified stored solution is provided for this problem, say so plainly (e.g. "I don't \
have a verified solution on file for this one, but here's how I'd approach it...") before \
reasoning from general physics principles - never present an improvised derivation as if it \
were the confirmed answer key.
- Keep replies concise and focused - a few short paragraphs or a small numbered list, not an \
essay. Use LaTeX ($...$ inline, $$...$$ display) for all math.
- Respond in the same language the student writes in (Indonesian or English)."""


def _format_problem_block(rec: ProblemRecord) -> str:
    parts_text = "\n".join(f"({sp.label}) {sp.text}" for sp in rec.subparts)
    block = f"Problem {rec.id} ({rec.level or '?'} {rec.year or ''}, topic: {rec.topic}):\n{rec.body_md}"
    if parts_text:
        block += f"\n{parts_text}"
    return block


def _format_prereq_block(problem_id: str, problems_by_id: dict[str, ProblemRecord]) -> str | None:
    graph = _load_prerequisites_by_id().get(problem_id)
    if not graph or not graph.get("prerequisites"):
        return None
    lines = []
    for edge in graph["prerequisites"][:3]:
        neighbor = problems_by_id.get(edge["id"])
        if neighbor is None:
            continue
        shared = ", ".join(edge.get("shared_concepts", []))
        lines.append(f"- {neighbor.id} \"{neighbor.title}\" (shares: {shared})")
    if not lines:
        return None
    return "This problem builds on techniques from these earlier problems:\n" + "\n".join(lines)


def build_system_prompt(
    problem_id: str | None,
    *,
    client_title: str | None = None,
    client_body: str | None = None,
) -> str:
    if not problem_id:
        return BASE_SYSTEM_PROMPT

    problems_by_id = _load_problems_by_id()
    rec = problems_by_id.get(problem_id)

    if rec is None:
        # Unknown id (e.g. stale client cache) - fall back to whatever the
        # client sent for display purposes only, clearly caveated.
        if client_title or client_body:
            return (
                BASE_SYSTEM_PROMPT
                + "\n\nCONTEXT (unverified - could not confirm this problem in our database):\n"
                + f"Title: {client_title or 'unknown'}\n{client_body or ''}"
            )
        return BASE_SYSTEM_PROMPT

    prompt = BASE_SYSTEM_PROMPT + "\n\nCONTEXT:\n" + _format_problem_block(rec)

    solution = _load_solutions_by_id().get(problem_id)
    if solution is not None:
        prompt += f"\n\nVerified stored solution (ground all hints/answers in this):\n{solution.body_md}"
    else:
        prompt += (
            "\n\nNo verified stored solution exists for this problem yet. You may reason from "
            "general physics principles, but you MUST tell the student this solution is not "
            "verified/on file before doing so."
        )

    prereq_block = _format_prereq_block(problem_id, problems_by_id)
    if prereq_block:
        prompt += f"\n\n{prereq_block}"

    return prompt
