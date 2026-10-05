"""Pytest fixtures for async FastAPI tests with an in-memory SQLite database.

Provides an in-memory SQLite substitute via SQLAlchemy + aiosqlite so that
tests never require a real database file.  StaticPool ensures all sessions
share the same underlying connection, so data written in one request handler
is visible to the next within the same test.  Each test fixture invocation
creates a fresh engine (and therefore an empty database) so there is no
state bleed between tests.

Fixtures:
    db_engine: The per-test in-memory engine, with ``get_database``
        overridden to use it.
    client_factory: Builds extra clients that share ``db_engine`` but send
        their own ``X-Session-ID`` header, simulating several browsers.
    client: The default single-browser client used by most tests.
"""
from collections.abc import AsyncIterator, Callable

import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.pool import StaticPool

from app.database import Base, get_database
from app.main import app

# X-Session-ID sent by the default ``client`` fixture.
DEFAULT_TEST_SESSION_ID = "test-session-123"


@pytest_asyncio.fixture
async def db_engine() -> AsyncIterator[AsyncEngine]:
    """Create a fresh in-memory SQLite engine and route the app's DB to it.

    The ``get_database`` dependency is overridden so all route handlers
    receive a session from this engine.  The override is removed and the
    engine disposed on teardown.

    Yields:
        The per-test ``AsyncEngine`` with the full schema created.
    """
    engine = create_async_engine(
        "sqlite+aiosqlite:///:memory:",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    session_factory = async_sessionmaker(engine, expire_on_commit=False)

    async def override_get_database() -> AsyncIterator[AsyncSession]:
        """Dependency override that yields a session from the in-memory test engine."""
        async with session_factory() as session:
            yield session

    app.dependency_overrides[get_database] = override_get_database
    yield engine
    app.dependency_overrides.clear()
    await engine.dispose()


@pytest_asyncio.fixture
async def client_factory(
    db_engine: AsyncEngine,
) -> AsyncIterator[Callable[[str], AsyncClient]]:
    """Return a factory for clients that act as distinct browsers.

    Every client built by the factory talks to the same app and the same
    in-memory database (``db_engine``) but sends its own ``X-Session-ID``
    header, so tests can assert per-browser data isolation.  All created
    clients are closed on teardown.

    Args:
        db_engine: The shared per-test engine fixture.

    Yields:
        A callable taking a session ID and returning an ``AsyncClient``
        whose requests carry that ID in ``X-Session-ID``.
    """
    created: list[AsyncClient] = []

    def make_client(session_id: str) -> AsyncClient:
        """Build a client that identifies itself with ``session_id``.

        Args:
            session_id: Value to send in the ``X-Session-ID`` header.

        Returns:
            An ``AsyncClient`` wired to the FastAPI app.
        """
        new_client = AsyncClient(
            transport=ASGITransport(app=app),
            base_url="http://test",
            headers={"X-Session-ID": session_id},
        )
        created.append(new_client)
        return new_client

    yield make_client
    for created_client in created:
        await created_client.aclose()


@pytest_asyncio.fixture
async def client(client_factory: Callable[[str], AsyncClient]) -> AsyncClient:
    """Return an AsyncClient wired to the FastAPI app with an in-memory SQLite DB.

    The X-Session-ID header is set to ``DEFAULT_TEST_SESSION_ID`` so that
    the session-identity dependency is satisfied and all of this client's
    data is scoped to that one browser.

    Args:
        client_factory: Factory fixture that builds per-browser clients.

    Returns:
        An active ``AsyncClient`` configured for testing.
    """
    return client_factory(DEFAULT_TEST_SESSION_ID)
