"""Pytest fixtures for async FastAPI tests with an in-memory SQLite database.

Provides an in-memory SQLite substitute via SQLAlchemy + aiosqlite so that
tests never require a real database file.  StaticPool ensures all sessions
share the same underlying connection, so data written in one request handler
is visible to the next within the same test.  Each test fixture invocation
creates a fresh engine (and therefore an empty database) so there is no
state bleed between tests.
"""
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

from app.database import Base, get_database
from app.main import app


@pytest_asyncio.fixture
async def client():
    """Return an AsyncClient wired to the FastAPI app with an in-memory SQLite DB.

    A fresh in-memory SQLite engine is created per test via StaticPool so there
    is no state bleed between tests.  The ``get_database`` dependency is
    overridden so all route handlers receive a session from this test engine.
    The X-Session-ID header is set to a fixed value so that the session-identity
    middleware is satisfied.

    Yields:
        An active ``AsyncClient`` configured for testing.
    """
    engine = create_async_engine(
        "sqlite+aiosqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    session_factory = async_sessionmaker(engine, expire_on_commit=False)

    async def override_get_database():
        """Dependency override that yields a session from the in-memory test engine."""
        async with session_factory() as session:
            yield session

    app.dependency_overrides[get_database] = override_get_database

    async with AsyncClient(
        transport=ASGITransport(app=app),
        base_url="http://test",
        headers={"X-Session-ID": "test-session-123"},
    ) as c:
        yield c

    app.dependency_overrides.clear()
    await engine.dispose()
