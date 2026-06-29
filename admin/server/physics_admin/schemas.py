from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, EmailStr, Field


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserResponse(BaseModel):
    id: int
    email: str
    subscription_status: str
    subscription_expires_at: datetime | None
    has_active_subscription: bool


class SubscribeRequest(BaseModel):
    plan: str = "monthly"


class SubscriptionResponse(BaseModel):
    subscription_status: str
    subscription_expires_at: datetime | None
    has_active_subscription: bool
    message: str


class SubPartSchema(BaseModel):
    label: str
    text: str


class ValidationIssueSchema(BaseModel):
    code: str
    message: str
    snippet: str | None = None


class ProblemSummary(BaseModel):
    id: str
    title: str
    level: str | None
    year: int | None
    topic: str
    topic_confidence: float
    error_count: int
    catalog_eligible: bool
    llm_repaired: bool


class ProblemDetail(BaseModel):
    id: str
    document_slug: str
    level: str | None
    year: int | None
    round: str | None
    variant: int | None
    problem_number: int
    title: str
    topic: str
    topic_confidence: float
    subparts: list[SubPartSchema]
    body_md: str
    title_en: str | None = None
    body_md_en: str | None = None
    subparts_en: list[SubPartSchema] = []
    errors: list[ValidationIssueSchema]
    catalog_eligible: bool
    flags: list[str]
    images: list[dict]


class ProblemUpdateRequest(BaseModel):
    title: str | None = None
    topic: str | None = None
    body_md: str | None = None
    title_en: str | None = None
    body_md_en: str | None = None
    subparts: list[SubPartSchema] | None = None
    subparts_en: list[SubPartSchema] | None = None


class ProblemListResponse(BaseModel):
    total: int
    problems: list[ProblemSummary]


class PublishResponse(BaseModel):
    gold_total: int
    catalog_total: int
    exported: bool
    message: str
