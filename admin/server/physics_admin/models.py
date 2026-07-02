from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy import DateTime, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from physics_admin.database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    email: Mapped[str] = mapped_column(String(320), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    subscription_status: Mapped[str] = mapped_column(String(32), default="none")
    subscription_expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    stripe_customer_id: Mapped[str | None] = mapped_column(String(128), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=lambda: datetime.now(UTC)
    )

    def has_active_subscription(self) -> bool:
        if self.subscription_status != "active":
            return False
        if self.subscription_expires_at is None:
            return True
        expires = self.subscription_expires_at
        if expires.tzinfo is None:
            expires = expires.replace(tzinfo=UTC)
        return expires > datetime.now(UTC)


class TutorUsageDay(Base):
    """Global daily spend/token counter for the public AI tutor endpoint - a
    hard stop against runaway cost regardless of how per-IP rate limiting is
    routed around (see physics_admin/tutor_budget.py)."""

    __tablename__ = "tutor_usage_days"

    date: Mapped[str] = mapped_column(String(10), primary_key=True)  # UTC "YYYY-MM-DD"
    request_count: Mapped[int] = mapped_column(Integer, default=0)
    total_tokens: Mapped[int] = mapped_column(Integer, default=0)
