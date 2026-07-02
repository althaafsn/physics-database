from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from src.graph.build_prerequisites import build_prerequisite_graph
from src.schema import ProblemRecord, ProblemSource


def _rec(id: str, topic: str) -> ProblemRecord:
    return ProblemRecord(
        id=id,
        document_slug="doc",
        problem_number=1,
        title=id,
        topic=topic,
        topic_confidence=0.9,
        body_md="body",
        source=ProblemSource(pdf="x.pdf", md="x.md", meta_json=""),
    )


def test_simpler_problem_becomes_prerequisite():
    records = [_rec("A", "mechanics"), _rec("B", "mechanics")]
    concepts = {"A": ["continuity-equation"], "B": ["continuity-equation", "bernoullis-equation"]}
    graph = build_prerequisite_graph(records, concepts)
    assert any(e.id == "A" for e in graph["B"].prerequisites)
    assert any(e.id == "B" for e in graph["A"].unlocks)


def test_unrelated_concepts_no_edge():
    records = [_rec("A", "mechanics"), _rec("B", "mechanics")]
    concepts = {"A": ["torque"], "B": ["continuity-equation", "bernoullis-equation"]}
    graph = build_prerequisite_graph(records, concepts)
    assert graph["B"].prerequisites == []


def test_different_topics_not_compared():
    records = [_rec("A", "mechanics"), _rec("B", "electromagnetism")]
    concepts = {"A": ["torque"], "B": ["torque", "coulombs-law"]}
    graph = build_prerequisite_graph(records, concepts)
    assert graph["B"].prerequisites == []


def test_equal_concept_sets_no_edge():
    records = [_rec("A", "mechanics"), _rec("B", "mechanics")]
    concepts = {"A": ["torque"], "B": ["torque"]}
    graph = build_prerequisite_graph(records, concepts)
    assert graph["A"].prerequisites == []
    assert graph["B"].prerequisites == []


def test_top_k_caps_edges():
    records = [_rec(f"simple{i}", "mechanics") for i in range(10)] + [_rec("complex", "mechanics")]
    concepts = {f"simple{i}": ["torque"] for i in range(10)}
    concepts["complex"] = ["torque", "friction"]
    graph = build_prerequisite_graph(records, concepts, top_k=3)
    assert len(graph["complex"].prerequisites) == 3
