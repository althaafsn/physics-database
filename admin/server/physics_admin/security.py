from __future__ import annotations

from fastapi import HTTPException, status

from physics_admin.config import get_settings


def is_email_allowed(email: str) -> bool:
    settings = get_settings()
    if not settings.is_production and settings.allow_public_registration:
        return True
    allowed = settings.allowed_email_set
    if allowed:
        return email.strip().lower() in allowed
    return False


def assert_email_allowed(email: str) -> None:
    if not is_email_allowed(email):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This account is not authorized to use the editor",
        )


def assert_registration_allowed(email: str) -> None:
    settings = get_settings()
    if settings.is_production and not settings.allowed_email_set:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Registration is disabled",
        )
    assert_email_allowed(email)
