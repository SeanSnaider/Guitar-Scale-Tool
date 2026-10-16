"""Shared FastAPI dependencies.

Kept in its own module so routers can depend on ``get_session_id`` without
importing ``app.main`` (which imports the routers).
"""
from fastapi import Header

# Maximum accepted length of the X-Session-ID header (the frontend sends a
# 36-character UUID).
SESSION_ID_MAX_LENGTH = 64


async def get_session_id(
    x_session_id: str = Header(..., min_length=1, max_length=SESSION_ID_MAX_LENGTH),
) -> str:
    """Extract and validate the client session identifier.

    Applied to all routers so that every request must supply an
    ``X-Session-ID`` header.  A missing, empty, or over-long header is
    rejected by FastAPI with a 422 response before the route runs.

    Args:
        x_session_id: Value of the ``X-Session-ID`` HTTP header.

    Returns:
        The raw session ID string.
    """
    return x_session_id
