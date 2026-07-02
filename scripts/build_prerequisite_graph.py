#!/usr/bin/env python3
"""Build the concept-subset prerequisite graph -> parsed/graph/prerequisites.jsonl.

Backend-only output (loaded by admin/server/physics_admin/tutor_context.py) -
never exported to public/data/*, per src/graph/__init__.py.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from src.graph.build_prerequisites import build_prerequisite_graph
from src.paths import PipelinePaths
from src.record_store import load_jsonl


def main() -> int:
    paths = PipelinePaths.resolve(ROOT)
    concepts_path = paths.parsed_dir / "concepts" / "solution_concepts.jsonl"
    if not concepts_path.is_file():
        print(f"Missing {concepts_path}. Run scripts/extract_solution_concepts.py first.")
        return 1

    concepts_by_id: dict[str, list[str]] = {}
    for line in concepts_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line:
            continue
        data = json.loads(line)
        concepts = data.get("solved_concepts") or []
        if concepts:
            concepts_by_id[data["problem_id"]] = concepts

    records = load_jsonl(paths.gold_problems_path, lenient=True)
    graph = build_prerequisite_graph(records, concepts_by_id)

    out_path = paths.parsed_dir / "graph" / "prerequisites.jsonl"
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with out_path.open("w", encoding="utf-8") as fh:
        for problem_id in sorted(graph):
            fh.write(json.dumps(graph[problem_id].as_dict(), ensure_ascii=False) + "\n")

    with_prereqs = sum(1 for g in graph.values() if g.prerequisites)
    with_unlocks = sum(1 for g in graph.values() if g.unlocks)
    print(f"Wrote {len(graph)} graph nodes -> {out_path}")
    print(f"  {with_prereqs} problems have >=1 prerequisite, {with_unlocks} unlock >=1 later problem")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
