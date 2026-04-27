"""FastAPI application entry point for the Guitar Learning Tool API.

Configures the application lifecycle (SQLAlchemy engine connect/disconnect),
CORS middleware, and includes all feature routers.  Every router
requires the ``X-Session-ID`` header via the ``get_session_id``
dependency which is applied globally through ``include_router``.
"""
from contextlib import asynccontextmanager
from typing import AsyncIterator

from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .database import connect_db, disconnect_db
from .routers import chords, scales, sessions, stats


async def get_session_id(x_session_id: str = Header(...)) -> str:
    """Extract and validate the client session identifier.

    This dependency is applied to all routers so that every request
    must supply an ``X-Session-ID`` header.  FastAPI's ``Header(...)``
    makes the parameter required; a missing header automatically
    results in a 422 response.

    Args:
        x_session_id: Value of the ``X-Session-ID`` HTTP header.

    Returns:
        The raw session ID string.

    Raises:
        HTTPException: 422 if the header is absent (handled by FastAPI).
    """
    return x_session_id


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    """Manage the SQLAlchemy engine lifecycle alongside the FastAPI app.

    Creates the async engine and schema on startup, then disposes the
    engine cleanly on shutdown so that no connections are leaked.

    Args:
        app: The FastAPI application instance (unused directly).

    Yields:
        Control to the running application.
    """
    await connect_db()
    yield
    await disconnect_db()


app = FastAPI(
    title="Guitar Learning Tool API",
    description="Backend API for tracking scale mastery, chord detection, and practice sessions.",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# All routers enforce session identity via the global dependency.
_session_dep = [Depends(get_session_id)]

app.include_router(sessions.router, dependencies=_session_dep)
app.include_router(scales.router, dependencies=_session_dep)
app.include_router(chords.router, dependencies=_session_dep)
app.include_router(stats.router, dependencies=_session_dep)


@app.get("/health", tags=["health"])
async def health() -> dict:
    """Health check endpoint.

    Returns a simple status object that load balancers and monitoring
    tools can poll to verify the service is running.

    Returns:
        A dict with a ``status`` key set to ``"ok"``.
    """
    return {"status": "ok"}
