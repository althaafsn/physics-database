from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, EmailStr, Field, field_validator


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
    # "verified" | "needs_review" | None (no ingested solution yet) - backend-only
    # editor signal, never exposed on the public reader site.
    solution_status: str | None = None


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


class TutorProblemContext(BaseModel):
    """Matches lib/ai-tutor.ts's TutorProblemContext exactly. `title`/`body`/
    `parts` are accepted for forward-compatibility but never trusted for
    grounding - the backend re-resolves the real record from `id` server-side
    (see physics_admin/tutor_context.py)."""

    id: str = Field(max_length=64)
    title: str | None = Field(default=None, max_length=500)
    body: str | None = Field(default=None, max_length=20_000)
    parts: list[dict] | None = None


class TutorMessage(BaseModel):
    role: str
    content: str = Field(min_length=1, max_length=4000)

    @field_validator("role")
    @classmethod
    def validate_role(cls, value: str) -> str:
        if value not in {"user", "assistant"}:
            raise ValueError("role must be 'user' or 'assistant'")
        return value


class TutorChatRequest(BaseModel):
    messages: list[TutorMessage] = Field(min_length=1, max_length=60)
    problem: TutorProblemContext | None = None


class TutorChatResponse(BaseModel):
    reply: str


class SolutionHintsResponse(BaseModel):
    problem_id: str
    available: bool = True
    total_hints: int
    hints: list[str] = Field(default_factory=list)
    full_markdown: str | None = None
