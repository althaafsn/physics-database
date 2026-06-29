from __future__ import annotations

import subprocess
from datetime import UTC, datetime, timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from physics_admin.auth import (
    create_access_token,
    get_current_user,
    hash_password,
    require_subscription,
    verify_password,
)
from physics_admin.config import get_settings
from physics_admin.database import get_db
from physics_admin.models import User
from physics_admin import problems as problem_service
from physics_admin.schemas import (
    LoginRequest,
    ProblemDetail,
    ProblemListResponse,
    ProblemSummary,
    ProblemUpdateRequest,
    PublishResponse,
    RegisterRequest,
    SubscribeRequest,
    SubscriptionResponse,
    SubPartSchema,
    TokenResponse,
    UserResponse,
    ValidationIssueSchema,
)
from src.catalog import is_catalog_eligible

router = APIRouter()
settings = get_settings()


def _user_response(user: User) -> UserResponse:
    return UserResponse(
        id=user.id,
        email=user.email,
        subscription_status=user.subscription_status,
        subscription_expires_at=user.subscription_expires_at,
        has_active_subscription=user.has_active_subscription(),
    )


@router.post("/auth/register", response_model=TokenResponse)
def register(body: RegisterRequest, db: Annotated[Session, Depends(get_db)]) -> TokenResponse:
    if db.query(User).filter(User.email == body.email).first():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")
    user = User(email=body.email, password_hash=hash_password(body.password))
    db.add(user)
    db.commit()
    db.refresh(user)
    return TokenResponse(access_token=create_access_token(user.id, user.email))


@router.post("/auth/login", response_model=TokenResponse)
def login(body: LoginRequest, db: Annotated[Session, Depends(get_db)]) -> TokenResponse:
    user = db.query(User).filter(User.email == body.email).first()
    if user is None or not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    return TokenResponse(access_token=create_access_token(user.id, user.email))


@router.get("/auth/me", response_model=UserResponse)
def me(user: Annotated[User, Depends(get_current_user)]) -> UserResponse:
    return _user_response(user)


@router.get("/billing/status", response_model=SubscriptionResponse)
def billing_status(user: Annotated[User, Depends(get_current_user)]) -> SubscriptionResponse:
    return SubscriptionResponse(
        subscription_status=user.subscription_status,
        subscription_expires_at=user.subscription_expires_at,
        has_active_subscription=user.has_active_subscription(),
        message="Mock billing active for local development",
    )


@router.post("/billing/subscribe", response_model=SubscriptionResponse)
def subscribe(
    body: SubscribeRequest,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> SubscriptionResponse:
    days = settings.mock_subscription_days
    if body.plan == "yearly":
        days *= 12
    user.subscription_status = "active"
    user.subscription_expires_at = datetime.now(UTC) + timedelta(days=days)
    db.add(user)
    db.commit()
    db.refresh(user)
    return SubscriptionResponse(
        subscription_status=user.subscription_status,
        subscription_expires_at=user.subscription_expires_at,
        has_active_subscription=True,
        message=f"Mock {body.plan} subscription activated for {days} days (local dev only)",
    )


def _problem_detail(rec) -> ProblemDetail:
    return ProblemDetail(
        id=rec.id,
        document_slug=rec.document_slug,
        level=rec.level,
        year=rec.year,
        round=rec.round,
        variant=rec.variant,
        problem_number=rec.problem_number,
        title=rec.title,
        topic=rec.topic,
        topic_confidence=rec.topic_confidence,
        subparts=[SubPartSchema(label=sp.label, text=sp.text) for sp in rec.subparts],
        body_md=rec.body_md,
        title_en=rec.title_en,
        body_md_en=rec.body_md_en,
        subparts_en=[SubPartSchema(label=sp.label, text=sp.text) for sp in rec.subparts_en],
        errors=[ValidationIssueSchema(**e.model_dump()) for e in rec.errors],
        catalog_eligible=is_catalog_eligible(rec),
        flags=rec.flags,
        images=[img.model_dump() for img in rec.images],
    )


@router.get("/problems", response_model=ProblemListResponse)
def problems_list(
    _user: Annotated[User, Depends(require_subscription)],
    q: str | None = None,
    level: str | None = None,
    errors_only: bool = False,
    limit: int = Query(default=100, le=500),
    offset: int = Query(default=0, ge=0),
) -> ProblemListResponse:
    records, total = problem_service.list_problems(
        q=q, level=level, errors_only=errors_only, limit=limit, offset=offset
    )
    return ProblemListResponse(
        total=total,
        problems=[
            ProblemSummary(
                id=rec.id,
                title=rec.title,
                level=rec.level,
                year=rec.year,
                topic=rec.topic,
                topic_confidence=rec.topic_confidence,
                error_count=len(rec.errors),
                catalog_eligible=is_catalog_eligible(rec),
                llm_repaired=rec.llm_repaired,
            )
            for rec in records
        ],
    )


@router.get("/problems/{problem_id}", response_model=ProblemDetail)
def problem_get(
    problem_id: str,
    _user: Annotated[User, Depends(require_subscription)],
) -> ProblemDetail:
    rec = problem_service.get_problem(problem_id)
    if rec is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Problem not found")
    return _problem_detail(rec)


@router.patch("/problems/{problem_id}", response_model=ProblemDetail)
def problem_update(
    problem_id: str,
    body: ProblemUpdateRequest,
    _user: Annotated[User, Depends(require_subscription)],
) -> ProblemDetail:
    updates = body.model_dump(exclude_unset=True)
    if not updates:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No fields to update")
    if "subparts" in updates and updates["subparts"] is not None:
        updates["subparts"] = [sp.model_dump() for sp in body.subparts or []]
    if "subparts_en" in updates and updates["subparts_en"] is not None:
        updates["subparts_en"] = [sp.model_dump() for sp in body.subparts_en or []]
    try:
        rec = problem_service.update_problem(problem_id, updates)
    except KeyError:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Problem not found") from None
    return _problem_detail(rec)


@router.post("/publish", response_model=PublishResponse)
def publish(_user: Annotated[User, Depends(require_subscription)]) -> PublishResponse:
    try:
        result = problem_service.publish_static()
    except subprocess.CalledProcessError as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=exc.stderr or str(exc),
        ) from exc
    return PublishResponse(
        gold_total=result["gold_total"],
        catalog_total=result["catalog_total"],
        exported=result["exported"],
        message="Catalog synced and public/data exported. Run npm run dev to preview reader.",
    )
