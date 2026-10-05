"""Common API response envelope types.

All endpoints return one of these wrappers so that clients have a
consistent shape to parse: a `success` flag, an optional `data` payload,
and an optional `error` string.
"""
from typing import Generic, TypeVar

from pydantic import BaseModel

T = TypeVar("T")

# Tempo bounds shared by every request that carries a BPM. They mirror the
# metronome's slider range in the frontend (AudioControlsShelf).
MIN_BPM = 20
MAX_BPM = 300

# Upper bound for the ``limit`` query parameter on paginated list endpoints.
MAX_PAGE_LIMIT = 100


class PaginationMeta(BaseModel):
    """Metadata attached to paginated list responses.

    Attributes:
        total: Total number of documents matching the query.
        page: Current 1-based page number.
        limit: Maximum items returned per page.
    """

    total: int
    page: int
    limit: int


class ApiResponse(BaseModel, Generic[T]):
    """Standard single-item response envelope.

    Attributes:
        success: True when the operation succeeded.
        data: The response payload; None on error.
        error: Human-readable error message; None on success.
    """

    success: bool
    data: T | None = None
    error: str | None = None


class PaginatedResponse(BaseModel, Generic[T]):
    """Standard paginated list response envelope.

    Attributes:
        success: True when the operation succeeded.
        data: List of items for the current page.
        meta: Pagination metadata (total, page, limit).
        error: Human-readable error message; None on success.
    """

    success: bool
    data: list[T]
    meta: PaginationMeta
    error: str | None = None
