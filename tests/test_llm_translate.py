from __future__ import annotations

import json
import sys
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from src.llm_client import ChatCompletionFailure, ChatCompletionResult, LLMCallMetrics
from src.llm_translate import (
    TranslationResult,
    accept_translation,
    apply_translation_to_record,
    cache_key,
    parse_translation_response,
    translate_record,
)
from src.schema import ProblemRecord, ProblemSource, SubPart

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


def _record(
    *,
    body_md: str,
    subparts: list[SubPart] | None = None,
    title: str = "Analisis Dimensi",
) -> ProblemRecord:
    return ProblemRecord(
        id="OSK-2003-01",
        document_slug="Soal OSK Fisika SMA 2003",
        level="OSK",
        year=2003,
        problem_number=1,
        title=title,
        topic="mechanics",
        topic_confidence=1.0,
        body_md=body_md,
        source=SOURCE,
        subparts=subparts or [],
    )


def test_parse_translation_response():
    payload = json.dumps(
        {
            "title": "Dimensional Analysis",
            "body_md": "Assume flow rate $Q$ is proportional to $r$.",
            "subparts": [{"label": "a", "text": "Find $Q$."}],
        }
    )
    result = parse_translation_response(payload)
    assert result.title == "Dimensional Analysis"
    assert "$Q$" in result.body_md
    assert result.subparts[0].label == "a"


def test_accept_translation_requires_image_refs():
    record = _record(body_md="Text ![](assets/OSK/2003/01/pic.jpeg) here.")
    translated = TranslationResult(
        title="Flow",
        body_md="Text here without image.",
        subparts=[],
    )
    ok, issues = accept_translation(record, translated)
    assert not ok
    assert any("missing image refs" in issue for issue in issues)


def test_accept_translation_requires_matching_subpart_labels():
    record = _record(
        body_md="Problem body.",
        subparts=[SubPart(label="a", text="Bagian a"), SubPart(label="b", text="Bagian b")],
    )
    translated = TranslationResult(
        title="Problem",
        body_md="Problem body.",
        subparts=[SubPart(label="a", text="Part a")],
    )
    ok, issues = accept_translation(record, translated)
    assert not ok
    assert any("labels mismatch" in issue for issue in issues)


def test_apply_translation_sets_record_fields():
    record = _record(body_md="Isi soal.")
    translated = TranslationResult(
        title="Problem title",
        body_md="Problem body.",
        subparts=[],
    )
    updated = apply_translation_to_record(record, translated, model="qwen3.6-35b")
    assert updated.title_en == "Problem title"
    assert updated.body_md_en == "Problem body."
    assert updated.llm_translated is True
    assert updated.llm_translate_model == "qwen3.6-35b"


def test_translate_record_uses_cache(tmp_path: Path):
    record = _record(body_md="Isi soal $x^2$.")
    key = cache_key(record)
    cache_root = tmp_path / "llm_cache"
    from src.llm_translate import save_cached_translation

    save_cached_translation(
        cache_root,
        record.id,
        key,
        TranslationResult(title="Title", body_md="Body $x^2$.", subparts=[]),
    )

    attempt = translate_record(record, cache_root=cache_root)
    assert attempt.from_cache is True
    assert attempt.result is not None
    assert attempt.result.title == "Title"


@patch("src.llm_translate.chat_completion_json")
def test_translate_record_calls_llm(mock_chat, tmp_path: Path):
    mock_chat.return_value = _mock_completion(
        json.dumps(
            {
                "title": "Dimensional Analysis",
                "body_md": "Assume $Q$ depends on $r$.",
                "subparts": [],
            }
        )
    )
    record = _record(body_md="Anggap $Q$ tergantung $r$.")
    attempt = translate_record(record, cache_root=tmp_path / "llm_cache")
    assert attempt.result is not None
    assert attempt.result.title == "Dimensional Analysis"
    mock_chat.assert_called_once()


@patch("src.llm_translate.chat_completion_json")
def test_translate_record_api_failure(mock_chat, tmp_path: Path):
    mock_chat.return_value = ChatCompletionFailure(
        reason="api_error",
        detail="timeout",
        metrics=None,
    )
    record = _record(body_md="Isi.")
    attempt = translate_record(record, cache_root=tmp_path / "llm_cache")
    assert attempt.result is None
    assert attempt.failure == "api_error"
