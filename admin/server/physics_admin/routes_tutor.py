"""Public (no login) AI tutor endpoint - matches lib/ai-tutor.ts's contract
exactly: POST {messages, problem} -> {reply}.

Cost/abuse controls, in order: per-IP hourly rate limit, per-conversation
turn cap, then a global daily token/request budget guard. All three run
BEFORE the (costed) LLM call.
"""
from __future__ import annotations

import os
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from physics_admin.config import get_settings
from physics_admin.database import get_db
from physics_admin.rate_limit import enforce_tutor_rate_limit
from physics_admin.schemas import TutorChatRequest, TutorChatResponse
from physics_admin.tutor_budget import budget_remaining, record_usage
from physics_admin.tutor_context import build_system_prompt
from src.llm_client import DEFAULT_OPENROUTER_MODEL, _llm_provider, _message_text, get_client

router = APIRouter()
settings = get_settings()

AT_CAPACITY_REPLY = (
    "The AI tutor is temporarily at capacity for today - please check back tomorrow, "
    "or browse the worked-solution catalog in the meantime. Sorry for the inconvenience!"
)


def _default_tutor_model() -> str:
    if settings.tutor_model:
        return settings.tutor_model
    provider = _llm_provider()
    if provider == "local":
        return os.environ.get("TUTOR_MODEL", "qwen2.5:7b-instruct")
    if provider == "openrouter":
        return os.environ.get("TUTOR_MODEL", DEFAULT_OPENROUTER_MODEL)
    return os.environ.get("TUTOR_MODEL", "qwen3.6-35b")


def _tutor_completion_kwargs(model: str) -> dict:
    """Provider-specific chat.completions.create kwargs."""
    kwargs: dict = {
        "model": model,
        "temperature": 0.4,
        "max_tokens": settings.tutor_max_reply_tokens,
    }
    # qwen3.6-35b (Netra) is a reasoning model that otherwise burns 1000+
    # hidden "thinking" tokens per reply before emitting the visible answer.
    if _llm_provider() == "netra":
        kwargs["extra_body"] = {"chat_template_kwargs": {"enable_thinking": False}}
    return kwargs


@router.post(
    "/tutor/chat",
    response_model=TutorChatResponse,
    dependencies=[Depends(enforce_tutor_rate_limit)],
)
def tutor_chat(body: TutorChatRequest, db: Annotated[Session, Depends(get_db)]) -> TutorChatResponse:
    if len(body.messages) > settings.tutor_max_turns:
        return TutorChatResponse(
            reply=(
                "This conversation has gotten pretty long! Please start a new question so I can "
                "keep giving focused, accurate help."
            )
        )

    if not budget_remaining(db):
        return TutorChatResponse(reply=AT_CAPACITY_REPLY)

    problem_id = body.problem.id if body.problem else None
    system_prompt = build_system_prompt(
        problem_id,
        client_title=body.problem.title if body.problem else None,
        client_body=body.problem.body if body.problem else None,
    )

    llm_messages = [{"role": "system", "content": system_prompt}]
    llm_messages.extend({"role": m.role, "content": m.content} for m in body.messages)

    client = get_client(timeout_s=60.0)
    model = _default_tutor_model()
    try:
        response = client.chat.completions.create(
            messages=llm_messages,
            **_tutor_completion_kwargs(model),
        )
    except RuntimeError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="The AI tutor is not configured yet. Please try again later.",
        ) from exc
    except Exception as exc:  # noqa: BLE001 - never leak upstream provider errors to the client
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="The AI tutor is temporarily unavailable. Please try again in a moment.",
        ) from exc

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
