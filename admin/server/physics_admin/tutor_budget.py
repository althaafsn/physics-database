"""Global daily spend/token budget guard for the public AI tutor endpoint.

This is a hard stop against runaway cost that applies regardless of how the
per-IP rate limiter (physics_admin/rate_limit.py) is routed around (e.g. a
botnet spreading requests across many IPs). Backed by a tiny SQLite row so it
survives process restarts, unlike the in-memory rate limiter.
"""
from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy.orm import Session

from physics_admin.config import get_settings
from physics_admin.models import TutorUsageDay

settings = get_settings()


def _today() -> str:
    return datetime.now(UTC).strftime("%Y-%m-%d")


def _get_or_create_today(db: Session) -> TutorUsageDay:
    today = _today()
    row = db.get(TutorUsageDay, today)
    if row is None:
        row = TutorUsageDay(date=today, request_count=0, total_tokens=0)
        db.add(row)
        db.commit()
        db.refresh(row)
    return row


def budget_remaining(db: Session) -> bool:
    """True when today's usage is still under both the request and token
    ceilings. Checked BEFORE making an LLM call."""
    row = _get_or_create_today(db)
    return (
        row.request_count < settings.tutor_daily_request_budget
        and row.total_tokens < settings.tutor_daily_token_budget
    )


def record_usage(db: Session, *, tokens_used: int) -> None:
    row = _get_or_create_today(db)
    row.request_count += 1
    row.total_tokens += max(0, tokens_used)
    db.add(row)
    db.commit()


def usage_snapshot(db: Session) -> dict:
    row = _get_or_create_today(db)
    return {
        "date": row.date,
        "request_count": row.request_count,
        "total_tokens": row.total_tokens,
        "request_budget": settings.tutor_daily_request_budget,
        "token_budget": settings.tutor_daily_token_budget,
    }
