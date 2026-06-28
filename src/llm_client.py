from __future__ import annotations

import os
import time
from dataclasses import dataclass
from typing import Any

from openai import OpenAI

from src.repair_log import LogFn

DEFAULT_BASE_URL = "https://api.netraruntime.com/v1"
DEFAULT_MODEL = "qwen3.6-35b"
DEFAULT_MAX_RETRIES = 3
DEFAULT_RETRY_DELAY_S = 2.0
DEFAULT_TIMEOUT_S = 120.0
DEFAULT_MAX_TOKENS = 8192
DEFAULT_REPAIR_MAX_TOKENS = 8192


@dataclass(frozen=True)
class LLMCallMetrics:
    model: str
    provider: str
    base_url: str
    prompt_tokens: int
    completion_tokens: int
    total_tokens: int
    latency_s: float
    wall_latency_s: float
    completion_tokens_per_s: float | None
    total_tokens_per_s: float | None
    attempts: int

    def as_dict(self) -> dict[str, Any]:
        return {
            "model": self.model,
            "provider": self.provider,
            "base_url": self.base_url,
            "prompt_tokens": self.prompt_tokens,
            "completion_tokens": self.completion_tokens,
            "total_tokens": self.total_tokens,
            "latency_s": round(self.latency_s, 3),
            "wall_latency_s": round(self.wall_latency_s, 3),
            "completion_tokens_per_s": (
                round(self.completion_tokens_per_s, 2)
                if self.completion_tokens_per_s is not None
                else None
            ),
            "total_tokens_per_s": (
                round(self.total_tokens_per_s, 2) if self.total_tokens_per_s is not None else None
            ),
            "attempts": self.attempts,
        }


@dataclass(frozen=True)
class ChatCompletionResult:
    content: str
    metrics: LLMCallMetrics
    finish_reason: str | None = None
    truncated: bool = False


@dataclass(frozen=True)
class ChatCompletionFailure:
    reason: str
    detail: str
    metrics: LLMCallMetrics | None = None


def _env_float(name: str, default: float) -> float:
    raw = os.environ.get(name)
    if raw is None or raw.strip() == "":
        return default
    return float(raw)


def _env_int(name: str, default: int) -> int:
    raw = os.environ.get(name)
    if raw is None or raw.strip() == "":
        return default
    return int(raw)


def get_client(*, timeout_s: float | None = None) -> OpenAI:
    api_key = os.environ.get("NETRA_API_KEY")
    if not api_key:
        raise RuntimeError("NETRA_API_KEY environment variable is not set")
    if timeout_s is None:
        timeout_s = _env_float("NETRA_TIMEOUT_S", DEFAULT_TIMEOUT_S)
    return OpenAI(
        base_url=os.environ.get("NETRA_BASE_URL", DEFAULT_BASE_URL),
        api_key=api_key,
        timeout=timeout_s,
        max_retries=0,
    )


def netra_provider_info() -> dict[str, str]:
    return {
        "provider": "netra",
        "base_url": os.environ.get("NETRA_BASE_URL", DEFAULT_BASE_URL),
    }


def _message_text(message: Any) -> str:
    content = getattr(message, "content", None)
    if isinstance(content, str) and content.strip():
        return content.strip()
    for attr in ("reasoning_content", "text"):
        val = getattr(message, attr, None)
        if isinstance(val, str) and val.strip():
            return val.strip()
    return ""


def _extract_usage(
    response: Any,
    *,
    model: str,
    latency_s: float,
    wall_latency_s: float,
    attempts: int,
) -> LLMCallMetrics:
    usage = getattr(response, "usage", None)
    prompt_tokens = int(getattr(usage, "prompt_tokens", 0) or 0)
    completion_tokens = int(getattr(usage, "completion_tokens", 0) or 0)
    total_tokens = int(getattr(usage, "total_tokens", 0) or 0)
    if total_tokens == 0:
        total_tokens = prompt_tokens + completion_tokens

    completion_tps = (
        completion_tokens / latency_s if latency_s > 0 and completion_tokens > 0 else None
    )
    total_tps = total_tokens / latency_s if latency_s > 0 and total_tokens > 0 else None
    info = netra_provider_info()
    return LLMCallMetrics(
        model=model,
        provider=info["provider"],
        base_url=info["base_url"],
        prompt_tokens=prompt_tokens,
        completion_tokens=completion_tokens,
        total_tokens=total_tokens,
        latency_s=latency_s,
        wall_latency_s=wall_latency_s,
        completion_tokens_per_s=completion_tps,
        total_tokens_per_s=total_tps,
        attempts=attempts,
    )


def chat_completion_json(
    *,
    messages: list[dict[str, str]],
    model: str = DEFAULT_MODEL,
    temperature: float = 0,
    max_retries: int = DEFAULT_MAX_RETRIES,
    retry_delay_s: float = DEFAULT_RETRY_DELAY_S,
    timeout_s: float | None = None,
    max_tokens: int | None = None,
    log: LogFn | None = None,
) -> ChatCompletionResult | ChatCompletionFailure:
    """Call Netra chat API; return content + metrics or structured failure."""
    if timeout_s is None:
        timeout_s = _env_float("NETRA_TIMEOUT_S", DEFAULT_TIMEOUT_S)
    if max_tokens is None:
        max_tokens = _env_int("NETRA_MAX_TOKENS", DEFAULT_MAX_TOKENS)

    client = get_client(timeout_s=timeout_s)
    kwargs: dict[str, Any] = {
        "model": model,
        "messages": messages,
        "temperature": temperature,
        "top_p": 1,
        "max_tokens": max_tokens,
        "extra_body": {"top_k": 40, "min_p": 0},
    }
    wall_start = time.perf_counter()
    attempts = 0
    last_error: Exception | None = None
    last_metrics: LLMCallMetrics | None = None

    for attempt in range(max_retries):
        attempts += 1
        if log:
            log(
                f"  → Netra API attempt {attempt + 1}/{max_retries} "
                f"(timeout={timeout_s:.0f}s, max_tokens={max_tokens})"
            )
        try:
            call_start = time.perf_counter()
            used_json_mode = True
            try:
                response = client.chat.completions.create(
                    **kwargs,
                    response_format={"type": "json_object"},
                )
            except Exception as json_exc:
                used_json_mode = False
                if log:
                    log(f"  → json_object mode unavailable ({json_exc.__class__.__name__}), retrying plain")
                response = client.chat.completions.create(**kwargs)
            latency_s = time.perf_counter() - call_start

            if not response.choices:
                last_error = RuntimeError("LLM returned no choices")
            else:
                finish_reason = getattr(response.choices[0], "finish_reason", None)
                text = _message_text(response.choices[0].message)
                last_metrics = _extract_usage(
                    response,
                    model=model,
                    latency_s=latency_s,
                    wall_latency_s=time.perf_counter() - wall_start,
                    attempts=attempts,
                )
                if text:
                    truncated = finish_reason == "length"
                    if truncated and log:
                        log(
                            f"  ⚠ response truncated at max_tokens={max_tokens} "
                            f"({last_metrics.completion_tokens} completion tokens)"
                        )
                    if log:
                        log(
                            f"  ← Netra responded in {latency_s:.1f}s "
                            f"({last_metrics.completion_tokens:,} completion tok, "
                            f"mode={'json' if used_json_mode else 'plain'})"
                        )
                    return ChatCompletionResult(
                        content=text,
                        metrics=last_metrics,
                        finish_reason=finish_reason,
                        truncated=truncated,
                    )
                last_error = RuntimeError("LLM returned empty response")
        except Exception as exc:
            last_error = exc
            if log:
                log(f"  ✗ API error: {exc.__class__.__name__}: {exc}")

        if attempt + 1 < max_retries:
            delay = retry_delay_s * attempt
            if log:
                log(f"  … retrying in {delay:.0f}s")
            time.sleep(delay)

    detail = f"{last_error.__class__.__name__}: {last_error}" if last_error else "unknown error"
    return ChatCompletionFailure(reason="api_error", detail=detail, metrics=last_metrics)


def format_metrics_line(metrics: LLMCallMetrics | None, *, cached: bool = False) -> str:
    if cached:
        return "cached | 0 tok | 0.0s"
    if metrics is None:
        return "no metrics"
    parts = [
        f"{metrics.completion_tokens_per_s:.1f} gen tok/s"
        if metrics.completion_tokens_per_s is not None
        else "n/a gen tok/s",
        f"{metrics.total_tokens:,} tok",
        f"{metrics.latency_s:.1f}s",
    ]
    if metrics.attempts > 1:
        parts.append(f"{metrics.attempts} attempts")
    return " | ".join(parts)
