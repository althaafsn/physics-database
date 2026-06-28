from __future__ import annotations

import json
import sys
from pathlib import Path
from unittest.mock import patch

import pytest

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from src.llm_client import ChatCompletionFailure, ChatCompletionResult, LLMCallMetrics
from src.llm_repair import (
    FixApplied,
    RepairResult,
    accept_repair,
    apply_repair_to_record,
    estimate_repair_max_tokens,
    parse_repair_response,
    should_use_compact_repair,
)
from src.schema import ProblemRecord, ProblemSource, SubPart, ValidationIssue
from src.validate import validate_record

SOURCE = ProblemSource(pdf="x.pdf", md="x.md", meta_json="x_meta.json")


def _mock_completion(content: str) -> ChatCompletionResult:
    return ChatCompletionResult(
        content=content,
        metrics=LLMCallMetrics(
            model="qwen3.6-35b",
            provider="netra",
            base_url="https://api.netraruntime.com/v1",
            prompt_tokens=500,
            completion_tokens=200,
            total_tokens=700,
            latency_s=4.0,
            wall_latency_s=4.2,
            completion_tokens_per_s=50.0,
            total_tokens_per_s=175.0,
            attempts=1,
        ),
    )


def _record(body_md: str) -> ProblemRecord:
    return ProblemRecord(
        id="OSK-2005-01",
        document_slug="Soal OSK Fisika SMA 2005",
        level="OSK",
        year=2005,
        problem_number=1,
        title="Transformasi Koordinat",
        topic="mixed",
        topic_confidence=0.0,
        body_md=body_md,
        body_md_raw=body_md,
        source=SOURCE,
    )


def test_accept_repair_clears_all_original_errors():
    raw = "Menurut kerangka acuan (, ), titik T mempunyai koordinat (, )."
    record = _record(raw)
    original = validate_record(record)
    repaired = RepairResult(
        body_md="Menurut kerangka acuan ($x$, $y$), titik T mempunyai koordinat ($x_T$, $y_T$).",
        subparts=[],
        fixes_applied=[
            FixApplied(
                code="blank_variable_slot",
                before="(, )",
                after="($x$, $y$)",
            )
        ],
    )
    ok, remaining = accept_repair(record, repaired, original)
    assert ok is True
    assert remaining == []


def test_accept_repair_rejects_incomplete_fix():
    raw = "Menurut kerangka acuan (, ), titik T mempunyai koordinat (, ). Nyatakan dalam , , dan ."
    record = _record(raw)
    original = validate_record(record)
    repaired = RepairResult(
        body_md="Menurut kerangka acuan ($x$, $y$), titik T mempunyai koordinat (, ). Nyatakan dalam , , dan .",
        subparts=[],
        fixes_applied=[],
    )
    ok, remaining = accept_repair(record, repaired, original)
    assert ok is False
    assert any(issue.code == "blank_variable_slot" for issue in remaining)


def test_parse_repair_response():
    payload = {
        "body_md": "Fixed body with $g = 10$ m/s$^2$.",
        "subparts": [{"label": "a", "text": "Part a"}],
        "fixes_applied": [{"code": "missing_g_constant", "before": "= 10", "after": "$g=10$"}],
    }
    result = parse_repair_response(json.dumps(payload))
    assert result.body_md.startswith("Fixed body")
    assert result.subparts[0].label == "a"


def test_parse_repair_response_tolerates_null_fix_fields():
    payload = {
        "body_md": "Fixed body with $g = 10$ m/s$^2$.",
        "subparts": [],
        "fixes_applied": [{"code": "missing_g_constant", "before": None, "after": None}],
    }
    result = parse_repair_response(json.dumps(payload))
    assert result.fixes_applied[0].before == ""
    assert result.fixes_applied[0].after == ""


def test_parse_repair_response_from_fenced_json():
    payload = json.dumps(
        {
            "body_md": "Clean text.",
            "subparts": [],
            "fixes_applied": [],
        }
    )
    result = parse_repair_response(f"```json\n{payload}\n```")
    assert result.body_md == "Clean text."


@patch("src.llm_repair.chat_completion_json")
def test_apply_repair_to_record_success(mock_chat):
    raw = "Gunakan percepatan gravitasi = 10 m/s 2 ."
    record = _record(raw)
    original = validate_record(record)
    mock_chat.return_value = _mock_completion(
        json.dumps(
            {
                "body_md": "Gunakan percepatan gravitasi $g = 10$ m/s$^2$.",
                "subparts": [],
                "fixes_applied": [
                    {
                        "code": "missing_g_constant",
                        "before": "= 10 m/s 2",
                        "after": "$g = 10$ m/s$^2$",
                    }
                ],
            }
        )
    )
    outcome = apply_repair_to_record(
        record,
        original,
        cache_dir=Path("/tmp/llm_cache_test_unused"),
    )
    assert outcome.succeeded is True
    assert outcome.record.llm_repaired is True
    assert outcome.remaining_errors == []


@patch("src.llm_repair.chat_completion_json")
def test_apply_repair_to_record_api_error(mock_chat):
    raw = "Gunakan percepatan gravitasi = 10 m/s 2 ."
    record = _record(raw)
    original = validate_record(record)
    mock_chat.return_value = ChatCompletionFailure(reason="api_error", detail="timeout")
    outcome = apply_repair_to_record(record, original)
    assert outcome.succeeded is False
    assert outcome.failure_reason == "api_error"
    assert outcome.record.body_md == raw


@patch("src.llm_repair.chat_completion_json")
def test_apply_repair_to_record_failure(mock_chat):
    raw = "Menurut kerangka acuan (, ), titik T mempunyai koordinat (, ). Nyatakan dalam , , dan ."
    record = _record(raw)
    original = validate_record(record)
    mock_chat.return_value = _mock_completion(
        json.dumps(
            {
                "body_md": "Menurut kerangka acuan ($x$, $y$), titik T mempunyai koordinat (, ). Nyatakan dalam , , dan .",
                "subparts": [],
                "fixes_applied": [],
            }
        )
    )
    outcome = apply_repair_to_record(record, original)
    assert outcome.succeeded is False
    assert outcome.record.body_md == raw
    assert any(issue.code == "blank_variable_slot" for issue in outcome.remaining_errors or [])


def test_estimate_repair_max_tokens_caps_runaway():
    record = _record("x" * 1000)
    assert estimate_repair_max_tokens(record) == 2024


def test_should_use_compact_repair_for_large_body():
    record = _record("x" * 5000)
    assert should_use_compact_repair(record) is True


@patch("src.llm_repair.chat_completion_json")
def test_apply_repair_retries_on_truncation(mock_chat):
    raw = "Gunakan percepatan gravitasi = 10 m/s 2 ."
    record = _record(raw)
    original = validate_record(record)
    truncated = ChatCompletionResult(
        content='{"body_md": "partial',
        metrics=_mock_completion("{}").metrics,
        finish_reason="length",
        truncated=True,
    )
    fixed = _mock_completion(
        json.dumps(
            {
                "body_md": "Gunakan percepatan gravitasi $g = 10$ m/s$^2$.",
                "subparts": [],
                "fixes_applied": [],
            }
        )
    )
    mock_chat.side_effect = [truncated, fixed]
    outcome = apply_repair_to_record(record, original)
    assert outcome.succeeded is True
    assert mock_chat.call_count == 2
