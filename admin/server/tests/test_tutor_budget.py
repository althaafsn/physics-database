import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from physics_admin.config import get_settings
from physics_admin.database import Base
from physics_admin import tutor_budget


@pytest.fixture
def db_session(monkeypatch):
    monkeypatch.setenv("TUTOR_DAILY_REQUEST_BUDGET", "2")
    monkeypatch.setenv("TUTOR_DAILY_TOKEN_BUDGET", "1000")
    get_settings.cache_clear()
    tutor_budget.settings = get_settings()

    engine = create_engine("sqlite:///:memory:", connect_args={"check_same_thread": False})
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(bind=engine)
    session = Session()
    yield session
    session.close()
    get_settings.cache_clear()


def test_budget_allows_under_request_cap(db_session):
    assert tutor_budget.budget_remaining(db_session) is True
    tutor_budget.record_usage(db_session, tokens_used=100)
    assert tutor_budget.budget_remaining(db_session) is True


def test_budget_blocks_after_request_cap(db_session):
    tutor_budget.record_usage(db_session, tokens_used=10)
    tutor_budget.record_usage(db_session, tokens_used=10)
    assert tutor_budget.budget_remaining(db_session) is False


def test_budget_blocks_after_token_cap(db_session):
    tutor_budget.record_usage(db_session, tokens_used=1000)
    assert tutor_budget.budget_remaining(db_session) is False


def test_usage_snapshot_reports_totals(db_session):
    tutor_budget.record_usage(db_session, tokens_used=50)
    snapshot = tutor_budget.usage_snapshot(db_session)
    assert snapshot["request_count"] == 1
    assert snapshot["total_tokens"] == 50
