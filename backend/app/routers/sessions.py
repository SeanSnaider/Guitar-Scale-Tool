"""Practice session lifecycle endpoints.

Provides routes to start a session, end it (computing duration), list
all sessions for the current user (paginated, newest first), and fetch
a single session by its integer primary key.
"""
import json
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import PracticeSession, get_database
from ..models.common import ApiResponse, PaginatedResponse, PaginationMeta
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


@router.post("/start", response_model=ApiResponse[PracticeSessionResponse])
async def start_session(
    body: PracticeSessionCreate,
    x_session_id: str = Header(...),
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
    db: AsyncSession = Depends(get_database),
) -> ApiResponse[PracticeSessionResponse]:
    """End an existing practice session and compute its duration.

    Args:
        practice_session_id: String representation of the integer session PK.
        body: Optional accuracy score.
        db: Injected SQLAlchemy async session.

    Returns:
        ApiResponse wrapping the updated session.

    Raises:
        HTTPException: 404 if no session with that ID exists.
    """
    pk = _parse_session_id(practice_session_id)
    now = datetime.now(timezone.utc)

    row: PracticeSession | None = await db.get(PracticeSession, pk)
    if row is None:
        raise HTTPException(status_code=404, detail="Session not found")

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
    page: int = 1,
    limit: int = 20,
    db: AsyncSession = Depends(get_database),
) -> PaginatedResponse[PracticeSessionResponse]:
    """List practice sessions, most recent first.

    Args:
        page: 1-based page number (default 1).
        limit: Maximum items per page (default 20).
        db: Injected SQLAlchemy async session.

    Returns:
        PaginatedResponse with session list and pagination metadata.
    """
    total: int = await db.scalar(
        select(func.count()).select_from(PracticeSession)
    )
    skip = (page - 1) * limit
    rows = (
        await db.scalars(
            select(PracticeSession)
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
    db: AsyncSession = Depends(get_database),
) -> ApiResponse[PracticeSessionResponse]:
    """Get a single practice session by its integer primary key.

    Args:
        practice_session_id: String representation of the integer PK.
        db: Injected SQLAlchemy async session.

    Returns:
        ApiResponse wrapping the session document.

    Raises:
        HTTPException: 404 if not found or ID is malformed.
    """
    pk = _parse_session_id(practice_session_id)
    row: PracticeSession | None = await db.get(PracticeSession, pk)
    if row is None:
        raise HTTPException(status_code=404, detail="Session not found")
    return ApiResponse(success=True, data=_serialize(row))
