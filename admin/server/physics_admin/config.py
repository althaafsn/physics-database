from __future__ import annotations

import os
import secrets
from functools import lru_cache
from pathlib import Path

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_env: str = "development"
    physics_db_root: Path = Path(__file__).resolve().parents[3]
    database_url: str = "sqlite:///./admin.db"
    jwt_secret: str = ""
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 60 * 24
    cors_origins: str = "http://localhost:3000,http://localhost:3001"
    mock_subscription_days: int = 30
    # Comma-separated admin emails allowed to register/login/edit (required in production).
    admin_allowed_emails: str = ""
    allow_mock_billing: bool = True
    allow_public_registration: bool = True

    @field_validator("app_env")
    @classmethod
    def normalize_env(cls, value: str) -> str:
        return value.strip().lower()

    @property
    def is_production(self) -> bool:
        return self.app_env == "production"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def allowed_email_set(self) -> set[str]:
        return {e.strip().lower() for e in self.admin_allowed_emails.split(",") if e.strip()}

    def effective_jwt_secret(self) -> str:
        if self.jwt_secret:
            return self.jwt_secret
        if self.is_production:
            raise RuntimeError("JWT_SECRET is required when APP_ENV=production")
        # Ephemeral secret for local dev only (tokens invalid after restart).
        return os.environ.get("_PHYSICS_ADMIN_DEV_JWT", secrets.token_urlsafe(48))

    def validate_security(self) -> None:
        if not self.is_production:
            return
        secret = self.jwt_secret
        if len(secret) < 32:
            raise RuntimeError("JWT_SECRET must be at least 32 characters in production")
        if not self.allowed_email_set:
            raise RuntimeError("ADMIN_ALLOWED_EMAILS must be set in production")
        if self.allow_mock_billing:
            raise RuntimeError("Set ALLOW_MOCK_BILLING=false in production")
        if self.allow_public_registration:
            raise RuntimeError("Set ALLOW_PUBLIC_REGISTRATION=false in production")


@lru_cache
def get_settings() -> Settings:
    settings = Settings()
    settings.validate_security()
    return settings
