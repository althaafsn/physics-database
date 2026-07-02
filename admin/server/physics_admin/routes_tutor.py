"""Public (no login) AI tutor endpoint - matches lib/ai-tutor.ts's contract
exactly: POST {messages, problem} -> {reply}.

Streaming variant: POST /tutor/chat/stream -> SSE events
  data: {"delta": "..."}  (token chunks)
  data: {"done": true}    (stream finished)
  data: {"error": "..."}  (provider failure; optional)

Cost/abuse controls, in order: per-IP hourly rate limit, per-conversation
turn cap, then a global daily token/request budget guard. All three run
BEFORE the (costed) LLM call.
"""
from __future__ import annotations

import json
import os
from collections.abc import Iterator
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from physics_admin.config import get_settings
from physics_admin.database import get_db
from physics_admin.rate_limit import enforce_tutor_rate_limit
from physics_admin.schemas import TutorChatRequest, TutorChatResponse
from physics_admin.tutor_budget import budget_remaining, record_usage
from physics_admin.tutor_context import build_system_prompt
from src.llm_client import (
    DEFAULT_TUTOR_OPENROUTER_MODEL,
    FALLBACK_TUTOR_OPENROUTER_MODEL,
    _llm_provider,
    _message_text,
    get_client,
)

router = APIRouter()
settings = get_settings()

AT_CAPACITY_REPLY = (
    "The AI tutor is temporarily at capacity for today - please check back tomorrow, "
    "or browse the worked-solution catalog in the meantime. Sorry for the inconvenience!"
)

TURN_LIMIT_REPLY = (
    "This conversation has gotten pretty long! Please start a new question so I can "
    "keep giving focused, accurate help."
)

STREAM_HEADERS = {
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
    "X-Accel-Buffering": "no",
}


def _default_tutor_model() -> str:
    if settings.tutor_model:
        return settings.tutor_model
    provider = _llm_provider()
    if provider == "local":
        return os.environ.get("TUTOR_MODEL", "qwen2.5:7b-instruct")
    if provider == "openrouter":
        return os.environ.get("TUTOR_MODEL", DEFAULT_TUTOR_OPENROUTER_MODEL)
    return os.environ.get("TUTOR_MODEL", "qwen3.6-35b")


def _tutor_model_candidates(primary: str) -> list[str]:
    """Primary model first, then optional fallback when OpenRouter rate-limits."""
    if _llm_provider() != "openrouter":
        return [primary]
    fallback = os.environ.get("TUTOR_MODEL_FALLBACK", FALLBACK_TUTOR_OPENROUTER_MODEL).strip()
    if fallback and fallback != primary:
        return [primary, fallback]
    return [primary]


def _is_rate_limited(exc: Exception) -> bool:
    msg = str(exc).lower()
    return "429" in msg or "rate limit" in msg or "too many requests" in msg


def _tutor_completion_kwargs(model: str, *, stream: bool = False) -> dict:
    """Provider-specific chat.completions.create kwargs."""
    kwargs: dict = {
        "model": model,
        "temperature": 0.4,
        "max_tokens": settings.tutor_max_reply_tokens,
    }
    if stream:
        kwargs["stream"] = True
        kwargs["stream_options"] = {"include_usage": True}
    # qwen3.6-35b (Netra) is a reasoning model that otherwise burns 1000+
    # hidden "thinking" tokens per reply before emitting the visible answer.
    if _llm_provider() == "netra":
        kwargs["extra_body"] = {"chat_template_kwargs": {"enable_thinking": False}}
    return kwargs


def _build_llm_messages(body: TutorChatRequest) -> list[dict[str, str]]:
    problem_id = body.problem.id if body.problem else None
    system_prompt = build_system_prompt(
        problem_id,
        client_title=body.problem.title if body.problem else None,
        client_body=body.problem.body if body.problem else None,
    )
    llm_messages = [{"role": "system", "content": system_prompt}]
    llm_messages.extend({"role": m.role, "content": m.content} for m in body.messages)
    return llm_messages


def _early_reply(body: TutorChatRequest, db: Session) -> str | None:
    if len(body.messages) > settings.tutor_max_turns:
        return TURN_LIMIT_REPLY
    if not budget_remaining(db):
        return AT_CAPACITY_REPLY
    return None


def _sse_event(payload: dict) -> str:
    return f"data: {json.dumps(payload, ensure_ascii=False)}\n\n"


def _stream_plaintext(reply: str) -> Iterator[str]:
    yield _sse_event({"delta": reply})
    yield _sse_event({"done": True})


def _stream_llm(llm_messages: list[dict[str, str]], db: Session) -> Iterator[str]:
    client = get_client(timeout_s=90.0)
    primary = _default_tutor_model()
    total_tokens = 0
    stream = None
    last_error: Exception | None = None

    for model in _tutor_model_candidates(primary):
        try:
            stream = client.chat.completions.create(
                messages=llm_messages,
                **_tutor_completion_kwargs(model, stream=True),
            )
            break
        except RuntimeError:
            yield _sse_event(
                {"error": "The AI tutor is not configured yet. Please try again later."}
            )
            yield _sse_event({"done": True})
            return
        except Exception as exc:  # noqa: BLE001
            last_error = exc
            if _is_rate_limited(exc) and model != _tutor_model_candidates(primary)[-1]:
                continue
            yield _sse_event(
                {"error": "The AI tutor is temporarily unavailable. Please try again in a moment."}
            )
            yield _sse_event({"done": True})
            return

    if stream is None:
        yield _sse_event(
            {"error": "The AI tutor is temporarily unavailable. Please try again in a moment."}
        )
        yield _sse_event({"done": True})
        return

    saw_content = False
    for chunk in stream:
        usage = getattr(chunk, "usage", None)
        if usage is not None:
            total_tokens = int(getattr(usage, "total_tokens", 0) or 0)

        if not chunk.choices:
            continue
        delta = chunk.choices[0].delta
        text = getattr(delta, "content", None) or ""
        if text:
            saw_content = True
            yield _sse_event({"delta": text})

    if not saw_content:
        yield _sse_event(
            {"error": "The AI tutor is temporarily unavailable. Please try again in a moment."}
        )
        yield _sse_event({"done": True})
        return

    record_usage(db, tokens_used=total_tokens)
    yield _sse_event({"done": True})


@router.post(
    "/tutor/chat",
    response_model=TutorChatResponse,
    dependencies=[Depends(enforce_tutor_rate_limit)],
)
def tutor_chat(body: TutorChatRequest, db: Annotated[Session, Depends(get_db)]) -> TutorChatResponse:
    early = _early_reply(body, db)
    if early:
        return TutorChatResponse(reply=early)

    llm_messages = _build_llm_messages(body)

    client = get_client(timeout_s=60.0)
    primary = _default_tutor_model()
    response = None
    last_error: Exception | None = None

    for model in _tutor_model_candidates(primary):
        try:
            response = client.chat.completions.create(
                messages=llm_messages,
                **_tutor_completion_kwargs(model),
            )
            break
        except RuntimeError as exc:
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="The AI tutor is not configured yet. Please try again later.",
            ) from exc
        except Exception as exc:  # noqa: BLE001
            last_error = exc
            if _is_rate_limited(exc) and model != _tutor_model_candidates(primary)[-1]:
                continue
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="The AI tutor is temporarily unavailable. Please try again in a moment.",
            ) from exc

    if response is None:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="The AI tutor is temporarily unavailable. Please try again in a moment.",
        )

    if not response.choices:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="The AI tutor is temporarily unavailable. Please try again in a moment.",
        )

    reply = _message_text(response.choices[0].message)
    if not reply:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="The AI tutor is temporarily unavailable. Please try again in a moment.",
        )

    usage = getattr(response, "usage", None)
    total_tokens = int(getattr(usage, "total_tokens", 0) or 0)
    record_usage(db, tokens_used=total_tokens)

    return TutorChatResponse(reply=reply)


@router.post(
    "/tutor/chat/stream",
    dependencies=[Depends(enforce_tutor_rate_limit)],
)
def tutor_chat_stream(
    body: TutorChatRequest,
    db: Annotated[Session, Depends(get_db)],
) -> StreamingResponse:
    early = _early_reply(body, db)
    if early:
        return StreamingResponse(
            _stream_plaintext(early),
            media_type="text/event-stream",
            headers=STREAM_HEADERS,
        )

    llm_messages = _build_llm_messages(body)
    return StreamingResponse(
        _stream_llm(llm_messages, db),
        media_type="text/event-stream",
        headers=STREAM_HEADERS,
    )
