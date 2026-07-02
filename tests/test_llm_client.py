from __future__ import annotations

import sys
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from src.llm_client import ChatCompletionFailure, ChatCompletionResult, LLMCallMetrics, _llm_provider, chat_completion_json
from src.llm_progress import RepairProgressStore


def _sample_metrics(**overrides) -> LLMCallMetrics:
    base = dict(
        model="qwen3.6-35b",
        provider="netra",
        base_url="https://api.netraruntime.com/v1",
        prompt_tokens=100,
        completion_tokens=50,
        total_tokens=150,
        latency_s=2.0,
        wall_latency_s=2.1,
        completion_tokens_per_s=25.0,
        total_tokens_per_s=75.0,
        attempts=1,
    )
    base.update(overrides)
    return LLMCallMetrics(**base)


@patch("src.llm_client.get_client")
def test_chat_completion_json_retries_empty_response(mock_get_client):
    message = type("Msg", (), {"content": "", "reasoning_content": None})()
    choice = type("Choice", (), {"message": message, "finish_reason": "stop"})()
    usage = type("Usage", (), {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0})()
    response = type("Response", (), {"choices": [choice], "usage": usage})()
    mock_get_client.return_value.chat.completions.create.return_value = response

    result = chat_completion_json(
        messages=[{"role": "user", "content": "hi"}],
        max_retries=2,
        retry_delay_s=0,
        log=lambda _msg: None,
    )
    assert isinstance(result, ChatCompletionFailure)
    assert result.reason == "api_error"
    assert mock_get_client.return_value.chat.completions.create.call_count == 2


@patch("src.llm_client.get_client")
def test_chat_completion_json_returns_metrics(mock_get_client):
    message = type("Msg", (), {"content": '{"ok": true}', "reasoning_content": None})()
    choice = type("Choice", (), {"message": message, "finish_reason": "stop"})()
    usage = type(
        "Usage",
        (),
        {"prompt_tokens": 120, "completion_tokens": 80, "total_tokens": 200},
    )()
    response = type("Response", (), {"choices": [choice], "usage": usage})()
    mock_get_client.return_value.chat.completions.create.return_value = response

    result = chat_completion_json(messages=[{"role": "user", "content": "hi"}])
    assert isinstance(result, ChatCompletionResult)
    assert result.content == '{"ok": true}'
    assert result.metrics.prompt_tokens == 120
    assert result.metrics.completion_tokens == 80
    assert result.metrics.total_tokens == 200
    assert result.metrics.completion_tokens_per_s is not None
    assert result.metrics.completion_tokens_per_s > 0


def test_llm_provider_openrouter_when_key_set(monkeypatch):
    monkeypatch.delenv("LLM_PROVIDER", raising=False)
    monkeypatch.setenv("OPENROUTER_API_KEY", "sk-or-test")
    monkeypatch.delenv("LOCAL_LLM_BASE_URL", raising=False)
    assert _llm_provider() == "openrouter"


def test_repair_progress_store(tmp_path: Path):
    path = tmp_path / "repair_progress.json"
    store = RepairProgressStore(path, model="qwen3.6-35b")
    store.mark("OSK-2003-01", cache_key="abc", status="succeeded", usage=_sample_metrics().as_dict())
    store.mark("OSK-2003-02", cache_key="def", status="api_error", error="empty response")

    reloaded = RepairProgressStore(path, model="qwen3.6-35b")
    assert reloaded.get("OSK-2003-01")["status"] == "succeeded"
    assert reloaded.stats["succeeded"] == 1
    assert reloaded.stats["api_error"] == 1
    assert reloaded.usage_totals["api_calls"] == 1
    assert reloaded.usage_totals["total_tokens"] == 150
    assert reloaded.usage_totals["avg_completion_tokens_per_s"] == 25.0
