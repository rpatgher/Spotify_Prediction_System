"""Test fixtures: in-memory SQLite DB + auth override.

Keycloak is NOT contacted in tests — the auth dependency is overridden to
return a fixed user id, so we exercise the real routing/persistence flow.
"""
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.db.base import Base
from app.db.session import get_db
from app.main import app
from app.security.auth import get_current_user_id, get_current_user_roles

TEST_USER = "test-user-123"


@pytest.fixture
def client():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    TestingSessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)

    def override_get_db():
        db = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user_id] = lambda: TEST_USER
    app.dependency_overrides[get_current_user_roles] = lambda: {"usuario", "productor"}

    with TestClient(app) as c:
        yield c

    app.dependency_overrides.clear()
