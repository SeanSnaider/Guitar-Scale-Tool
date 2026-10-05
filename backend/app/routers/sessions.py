"""Practice session lifecycle endpoints.

Provides routes to start a session, end it (computing duration), list
the calling browser's sessions (paginated, newest first), and fetch a
single session by its integer primary key.

Every route is scoped to the caller's ``X-Session-ID``: a session owned by
another browser is reported as 404 (never 403) so its existence does not
leak.
"""
import json
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import PracticeSession, get_database
from ..dependencies import get_session_id
from ..models.common import (
    MAX_PAGE_LIMIT,
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
        HTTPException: 404 if the string cannot be parsed as an integer.
    """
    try:
        return int(raw_id)
    except (ValueError, TypeError):
        raise HTTPException(status_code=404, detail="Session not found")


async def _get_owned_session(
    db: AsyncSession, raw_id: str, session_id: str
) -> PracticeSession:
    """Load a practice session that belongs to the calling browser.

    Args:
        db: Active async session.
        raw_id: String representation of the integer primary key.
        session_id: The caller's ``X-Session-ID``.

    Returns:
        The matching ORM row.

    Raises:
        HTTPException: 404 if the ID is malformed, no such session exists,
            or it belongs to another browser (indistinguishable on purpose).
    """
    pk = _parse_session_id(raw_id)
    row: PracticeSession | None = await db.scalar(
        select(PracticeSession).where(
            PracticeSession.id == pk, PracticeSession.session_id == session_id
        )
    )
    if row is None:
        raise HTTPException(status_code=404, detail="Session not found")
    return row


@router.post("/start", response_model=ApiResponse[PracticeSessionResponse])
async def start_session(
    body: PracticeSessionCreate,
    session_id: str = Depends(get_session_id),
    db: AsyncSession = Depends(get_database),
) -> ApiResponse[PracticeSessionResponse]:
    """Start a new practice session.

    Creates a new row in the ``practice_sessions`` table with the current
    UTC timestamp as ``started_at``. The ``session_id`` is taken from the
    ``X-Session-ID`` request header and makes the caller its owner.

    Args:
        body: Optional initial configuration (scales, bpm).
        session_id: The caller's ``X-Session-ID``.
        db: Injected SQLAlchemy async session.

    Returns:
        ApiResponse wrapping the newly created session.
    """
    row = PracticeSession(
        session_id=session_id,
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
    session_id: str = Depends(get_session_id),
    db: AsyncSession = Depends(get_database),
) -> ApiResponse[PracticeSessionResponse]:
    """End one of the caller's practice sessions and compute its duration.

    Args:
        practice_session_id: String representation of the integer session PK.
        body: Optional accuracy score.
        session_id: The caller's ``X-Session-ID``.
        db: Injected SQLAlchemy async session.

    Returns:
        ApiResponse wrapping the updated session.

    Raises:
        HTTPException: 404 if no session with that ID exists for the
            caller (including one owned by another browser); 409 if the
            session has already been ended (re-ending would overwrite the
            recorded duration and inflate total practice time).
    """
    row = await _get_owned_session(db, practice_session_id, session_id)
    now = datetime.now(timezone.utc)

    if row.ended_at is not None:
        raise HTTPException(status_code=409, detail="Session has already ended")

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
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=MAX_PAGE_LIMIT),
    session_id: str = Depends(get_session_id),
    db: AsyncSession = Depends(get_database),
) -> PaginatedResponse[PracticeSessionResponse]:
    """List the caller's practice sessions, most recent first.

    Args:
        page: 1-based page number (default 1, must be >= 1).
        limit: Maximum items per page (default 20, 1 to MAX_PAGE_LIMIT).
        session_id: The caller's ``X-Session-ID``; only its sessions are
            listed and counted.
        db: Injected SQLAlchemy async session.

    Returns:
        PaginatedResponse with session list and pagination metadata.
    """
    is_owned = PracticeSession.session_id == session_id
    total: int = await db.scalar(
        select(func.count()).select_from(PracticeSession).where(is_owned)
    )
    skip = (page - 1) * limit
    rows = (
        await db.scalars(
            select(PracticeSession)
            .where(is_owned)
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
    session_id: str = Depends(get_session_id),
    db: AsyncSession = Depends(get_database),
) -> ApiResponse[PracticeSessionResponse]:
    """Get one of the caller's practice sessions by its integer primary key.

    Args:
        practice_session_id: String representation of the integer PK.
        session_id: The caller's ``X-Session-ID``.
        db: Injected SQLAlchemy async session.

    Returns:
        ApiResponse wrapping the session document.

    Raises:
        HTTPException: 404 if not found, owned by another browser, or the
            ID is malformed.
    """
    row = await _get_owned_session(db, practice_session_id, session_id)
    return ApiResponse(success=True, data=_serialize(row))
