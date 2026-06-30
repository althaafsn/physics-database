import pytest
from fastapi import HTTPException

from physics_admin.config import Settings, get_settings
from physics_admin.security import assert_email_allowed, is_email_allowed


@pytest.fixture
def production_settings(monkeypatch):
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.setenv("JWT_SECRET", "x" * 32)
    monkeypatch.setenv("ADMIN_ALLOWED_EMAILS", "admin@example.com")
    monkeypatch.setenv("ALLOW_MOCK_BILLING", "false")
    monkeypatch.setenv("ALLOW_PUBLIC_REGISTRATION", "false")
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


def test_allowlist_open_in_development(monkeypatch):
    monkeypatch.setenv("APP_ENV", "development")
    monkeypatch.setenv("ADMIN_ALLOWED_EMAILS", "")
    get_settings.cache_clear()
    assert is_email_allowed("anyone@example.com") is True
    get_settings.cache_clear()


def test_allowlist_enforced_in_production(production_settings):
    assert is_email_allowed("admin@example.com") is True
    assert is_email_allowed("stranger@example.com") is False


def test_assert_email_allowed_raises(production_settings):
    with pytest.raises(HTTPException) as exc:
        assert_email_allowed("stranger@example.com")
    assert exc.value.status_code == 403


def test_production_rejects_weak_config():
    with pytest.raises(RuntimeError):
        Settings(
            app_env="production",
            jwt_secret="short",
            admin_allowed_emails="a@b.com",
            allow_mock_billing=False,
            allow_public_registration=False,
        ).validate_security()
