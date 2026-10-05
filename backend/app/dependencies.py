"""Shared FastAPI dependencies.

Holds ``get_session_id``, which resolves the caller's browser identity from
the ``X-Session-ID`` header.  It lives in its own module (rather than in
``main.py``) so that routers can depend on it without importing the app
module, which itself imports the routers.

Every row the API stores is owned by one session ID, and every query is
filtered by it, so this value is the data-isolation boundary between
browsers.  It is a client-generated identifier, not an authenticated
identity: anyone who learns another browser's ID can read that browser's
data.
"""
from fastapi import Header

# Bounds for the X-Session-ID value.  The frontend sends a 36-character
# UUID; the upper bound leaves headroom while stopping arbitrarily large
# strings from being stored on every row.
MIN_SESSION_ID_LENGTH = 1
MAX_SESSION_ID_LENGTH = 128


async def get_session_id(
    x_session_id: str = Header(
        ..., min_length=MIN_SESSION_ID_LENGTH, max_length=MAX_SESSION_ID_LENGTH
    ),
) -> str:
    """Extract and validate the client session identifier.

    Applied to every router in ``main.py`` so that every request must
    supply an ``X-Session-ID`` header, and injected into handlers that need
    the value to scope their queries.  FastAPI caches dependency results
    per request, so declaring it in both places costs nothing extra.

    An empty value is rejected: it would otherwise act as one shared
    bucket for every client that sends a blank header.

    Args:
        x_session_id: Value of the ``X-Session-ID`` HTTP header.

    Returns:
        The raw session ID string.

    Raises:
        HTTPException: 422 if the header is absent, empty, or longer than
            ``MAX_SESSION_ID_LENGTH`` (raised by FastAPI validation).
    """
    return x_session_id
