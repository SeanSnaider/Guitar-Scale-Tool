"""FastAPI application entry point for the Guitar Learning Tool API.

Configures the application lifecycle (SQLAlchemy engine connect/disconnect),
CORS middleware, and includes all feature routers.  Every router
requires the ``X-Session-ID`` header via the ``get_session_id``
dependency which is applied globally through ``include_router``.

Every error response is JSON of the form
``{"success": false, "error": <message>, "detail": <original detail>}``.
``detail`` keeps FastAPI's usual payload so existing clients still work.
"""
import logging
from contextlib import asynccontextmanager
from http import HTTPStatus
from typing import Any, AsyncIterator

from fastapi import Depends, FastAPI, Request
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException
from starlette.types import ASGIApp, Message, Receive, Scope, Send

from .config import settings
from .database import connect_db, disconnect_db
from .dependencies import get_session_id
from .routers import chords, scales, sessions, stats

logger = logging.getLogger(__name__)

_INTERNAL_ERROR_MESSAGE = "Internal server error"


def _error_response(
    status_code: int,
    error: str,
    detail: Any,
    headers: dict[str, str] | None = None,
) -> JSONResponse:
    """Build the standard JSON error envelope.

    Args:
        status_code: HTTP status to return.
        error: Human-readable message for ``error``.
        detail: Original detail payload (string or validation error list).
        headers: Optional extra response headers.

    Returns:
        A JSONResponse with ``success``, ``error`` and ``detail`` keys.
    """
    return JSONResponse(
        status_code=status_code,
        content={
            "success": False,
            "error": error,
            "detail": jsonable_encoder(detail),
        },
        headers=headers,
    )


async def http_exception_handler(
    request: Request, exc: StarletteHTTPException
) -> JSONResponse:
    """Render HTTPExceptions (including routing 404/405) as the error envelope."""
    if isinstance(exc.detail, str) and exc.detail:
        message = exc.detail
    else:
        try:
            message = HTTPStatus(exc.status_code).phrase
        except ValueError:
            message = "HTTP error"
    return _error_response(
        exc.status_code, message, exc.detail, getattr(exc, "headers", None)
    )


async def validation_exception_handler(
    request: Request, exc: RequestValidationError
) -> JSONResponse:
    """Render request validation failures as a 422 error envelope.

    ``error`` summarises the first problem (e.g. ``"body.bpm: Input should
    be greater than or equal to 20"``); ``detail`` is FastAPI's full list.
    """
    errors = exc.errors()
    message = "Request validation failed"
    if errors:
        first = errors[0]
        loc = ".".join(str(part) for part in first.get("loc", ()))
        msg = first.get("msg", "")
        message = f"{loc}: {msg}" if loc else msg or message
    return _error_response(422, message, errors)


async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """Render any uncaught exception as a 500 error envelope (no internals leaked)."""
    logger.exception("Unhandled error on %s %s", request.method, request.url.path)
    return _error_response(500, _INTERNAL_ERROR_MESSAGE, _INTERNAL_ERROR_MESSAGE)


class CatchUnhandledErrorsMiddleware:
    """ASGI middleware that turns uncaught exceptions into JSON 500s.

    Starlette routes ``Exception`` handlers through its outermost
    ServerErrorMiddleware, which sits *outside* CORSMiddleware, so those
    500s would reach the browser without CORS headers (an opaque network
    error).  Installing this inside CORSMiddleware keeps 500s readable.
    """

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        response_started = False

        async def send_wrapper(message: Message) -> None:
            nonlocal response_started
            if message["type"] == "http.response.start":
                response_started = True
            await send(message)

        try:
            await self.app(scope, receive, send_wrapper)
        except Exception as exc:
            if response_started:
                raise
            response = await unhandled_exception_handler(Request(scope), exc)
            await response(scope, receive, send)


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

app.add_exception_handler(StarletteHTTPException, http_exception_handler)
app.add_exception_handler(RequestValidationError, validation_exception_handler)
app.add_exception_handler(Exception, unhandled_exception_handler)

# Middleware added later wraps earlier middleware, so CORS ends up outside
# the catch-all and is applied to its 500 responses too.
app.add_middleware(CatchUnhandledErrorsMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    # No cookies or HTTP auth are used; the session id travels in a header.
    allow_credentials=False,
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
