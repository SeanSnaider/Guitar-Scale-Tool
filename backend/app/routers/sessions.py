"""Practice session lifecycle endpoints.

Provides routes to start a session, end it (computing duration), list
all sessions for the current user (paginated, newest first), and fetch
a single session by its integer primary key.

Sessions are scoped to the caller's ``X-Session-ID`` header: a client only
sees and can end its own sessions; anyone else's id returns 404.  This is
minimal client scoping, not authentication (the header is unauthenticated).
Scale mastery, chord history, and stats are still shared across all
clients because their tables have no owner column.
"""
import json
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import PracticeSession, get_database
from ..dependencies import get_session_id
from ..models.common import (
    MAX_LIMIT,
    MAX_PAGE,
    ApiResponse,
    PaginatedResponse,
    PaginationMeta,
)
from ..models.session import (
    PracticeSessionCreate,
    PracticeSessionEnd,
    PracticeSessionResponse,
)

router = APIRouter(prefix="/sessions", tags=["sessions"])

# Largest value SQLite's signed 64-bit INTEGER can hold.  Larger ids would
# make the driver raise OverflowError (a 500), so they are treated as 404.
_MAX_DB_INT = 2**63 - 1


def _serialize(row: PracticeSession) -> PracticeSessionResponse:
    """Convert a PracticeSession ORM row to a PracticeSessionResponse.

    Args:
        row: ORM row from the practice_sessions table.

    Returns:
        A validated PracticeSessionResponse instance.
    """
    return PracticeSessionResponse(
        id=str(row.id),
        session_id=row.session_id,
        started_at=row.started_at,
        ended_at=row.ended_at,
        duration_seconds=row.duration_seconds,
        scales_practiced=json.loads(row.scales_practiced),
        bpm=row.bpm,
        accuracy=row.accuracy,
    )


def _parse_session_id(raw_id: str) -> int:
    """Parse a session ID string to an integer, raising 404 on failure.

    Args:
        raw_id: String representation of the integer primary key.

    Returns:
        The parsed integer ID.

    Raises:
        HTTPException: 404 if the string cannot be parsed as an integer or
            is outside the range of a positive SQLite INTEGER.
    """
    try:
        pk = int(raw_id)
    except (ValueError, TypeError):
        raise HTTPException(status_code=404, detail="Session not found")
    if pk < 1 or pk > _MAX_DB_INT:
        raise HTTPException(status_code=404, detail="Session not found")
    return pk


async def _get_owned_session(
    db: AsyncSession, raw_id: str, x_session_id: str
) -> PracticeSession:
    """Load a session by PK, returning 404 unless it belongs to the caller.

    Args:
        db: Active async session.
        raw_id: String representation of the integer primary key.
        x_session_id: The caller's ``X-Session-ID`` header value.

    Returns:
        The matching PracticeSession row.

    Raises:
        HTTPException: 404 if the id is malformed, missing, or owned by a
            different client (deliberately indistinguishable).
    """
    pk = _parse_session_id(raw_id)
    row: PracticeSession | None = await db.get(PracticeSession, pk)
    if row is None or row.session_id != x_session_id:
        raise HTTPException(status_code=404, detail="Session not found")
    return row


@router.post("/start", response_model=ApiResponse[PracticeSessionResponse])
async def start_session(
    body: PracticeSessionCreate,
    x_session_id: str = Depends(get_session_id),
    db: AsyncSession = Depends(get_database),
) -> ApiResponse[PracticeSessionResponse]:
    """Start a new practice session.

    Creates a new row in the ``practice_sessions`` table with the current
    UTC timestamp as ``started_at``. The ``session_id`` is taken from the
    ``X-Session-ID`` request header.

    Args:
        body: Optional initial configuration (scales, bpm).
        x_session_id: Value of the ``X-Session-ID`` HTTP header.
        db: Injected SQLAlchemy async session.

    Returns:
        ApiResponse wrapping the newly created session.
    """
    row = PracticeSession(
        session_id=x_session_id,
        started_at=datetime.now(timezone.utc),
        scales_practiced=json.dumps(body.scales_practiced),
        bpm=body.bpm,
    )
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return ApiResponse(success=True, data=_serialize(row))


@router.post(
    "/{practice_session_id}/end",
    response_model=ApiResponse[PracticeSessionResponse],
)
async def end_session(
    practice_session_id: str,
    body: PracticeSessionEnd,
    x_session_id: str = Depends(get_session_id),
    db: AsyncSession = Depends(get_database),
) -> ApiResponse[PracticeSessionResponse]:
    """End an existing practice session and compute its duration.

    Ending is idempotent: if the session has already ended, the stored row
    is returned unchanged (``ended_at``, ``duration_seconds`` and
    ``accuracy`` are not overwritten).

    Args:
        practice_session_id: String representation of the integer session PK.
        body: Optional accuracy score.
        x_session_id: The caller's ``X-Session-ID`` header value.
        db: Injected SQLAlchemy async session.

    Returns:
        ApiResponse wrapping the updated (or already-ended) session.

    Raises:
        HTTPException: 404 if no session with that ID exists for the caller.
    """
    row = await _get_owned_session(db, practice_session_id, x_session_id)
    if row.ended_at is not None:
        return ApiResponse(success=True, data=_serialize(row))

    now = datetime.now(timezone.utc)

    started_at = row.started_at
    if started_at.tzinfo is None:
        started_at = started_at.replace(tzinfo=timezone.utc)
    duration = (now - started_at).total_seconds()

    row.ended_at = now
    row.duration_seconds = duration
    if body.accuracy is not None:
        row.accuracy = body.accuracy

    await db.commit()
    await db.refresh(row)
    return ApiResponse(success=True, data=_serialize(row))


@router.get("", response_model=PaginatedResponse[PracticeSessionResponse])
async def list_sessions(
    page: int = Query(1, ge=1, le=MAX_PAGE),
    limit: int = Query(20, ge=1, le=MAX_LIMIT),
    x_session_id: str = Depends(get_session_id),
    db: AsyncSession = Depends(get_database),
) -> PaginatedResponse[PracticeSessionResponse]:
    """List the caller's practice sessions, most recent first.

    Only sessions whose ``session_id`` matches the caller's
    ``X-Session-ID`` header are counted and returned.

    Args:
        page: 1-based page number (default 1).
        limit: Maximum items per page (default 20, max 100).
        x_session_id: The caller's ``X-Session-ID`` header value.
        db: Injected SQLAlchemy async session.

    Returns:
        PaginatedResponse with session list and pagination metadata.
    """
    owned = PracticeSession.session_id == x_session_id
    total: int = await db.scalar(
        select(func.count()).select_from(PracticeSession).where(owned)
    )
    skip = (page - 1) * limit
    rows = (
        await db.scalars(
            select(PracticeSession)
            .where(owned)
            .order_by(PracticeSession.started_at.desc())
            .offset(skip)
            .limit(limit)
        )
    ).all()
    return PaginatedResponse(
        success=True,
        data=[_serialize(r) for r in rows],
        meta=PaginationMeta(total=total, page=page, limit=limit),
    )


@router.get(
    "/{practice_session_id}",
    response_model=ApiResponse[PracticeSessionResponse],
)
async def get_session(
    practice_session_id: str,
    x_session_id: str = Depends(get_session_id),
    db: AsyncSession = Depends(get_database),
) -> ApiResponse[PracticeSessionResponse]:
    """Get one of the caller's practice sessions by its integer primary key.

    Args:
        practice_session_id: String representation of the integer PK.
        x_session_id: The caller's ``X-Session-ID`` header value.
        db: Injected SQLAlchemy async session.

    Returns:
        ApiResponse wrapping the session document.

    Raises:
        HTTPException: 404 if not found, malformed, or owned by another client.
    """
    row = await _get_owned_session(db, practice_session_id, x_session_id)
    return ApiResponse(success=True, data=_serialize(row))
