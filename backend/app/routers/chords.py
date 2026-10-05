"""Chord detection history endpoints.

Stores individual chord detection events from the AI layer and provides
list and aggregated statistics queries.  Every detection is owned by the
``X-Session-ID`` that recorded it, and every query only sees the caller's
own detections.
"""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import ChordDetection, get_database
from ..dependencies import get_session_id
from ..models.chord import (
    ChordCountItem,
    ChordQualityItem,
    ChordRecordCreate,
    ChordRecordResponse,
    ChordStatsResponse,
)
from ..models.common import (
    MAX_PAGE_LIMIT,
    ApiResponse,
    PaginatedResponse,
    PaginationMeta,
)

router = APIRouter(prefix="/chords", tags=["chords"])


def _serialize(row: ChordDetection) -> ChordRecordResponse:
    """Convert a ChordDetection ORM row to a ChordRecordResponse.

    Args:
        row: ORM row from the chord_detections table.

    Returns:
        A validated ChordRecordResponse instance.
    """
    return ChordRecordResponse(
        id=str(row.id),
        chord=row.chord,
        confidence=row.confidence,
        root=row.root,
        quality=row.quality,
        detected_at=row.detected_at,
        practice_session_id=row.practice_session_id,
    )


@router.post("", response_model=ApiResponse[ChordRecordResponse])
async def record_chord(
    body: ChordRecordCreate,
    session_id: str = Depends(get_session_id),
    db: AsyncSession = Depends(get_database),
) -> ApiResponse[ChordRecordResponse]:
    """Record a single chord detection event owned by the caller.

    The ``detected_at`` timestamp is set server-side to the current UTC time.

    Args:
        body: Chord detection data including chord name, confidence, root,
              quality, and optional session linkage.
        session_id: The caller's ``X-Session-ID``; becomes the row's owner.
        db: Injected SQLAlchemy async session.

    Returns:
        ApiResponse containing the newly stored chord record.
    """
    row = ChordDetection(
        session_id=session_id,
        chord=body.chord,
        confidence=body.confidence,
        root=body.root,
        quality=body.quality,
        detected_at=datetime.now(timezone.utc),
        practice_session_id=body.practice_session_id,
    )
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return ApiResponse(success=True, data=_serialize(row))


@router.get("/stats", response_model=ApiResponse[ChordStatsResponse])
async def get_chord_stats(
    session_id: str = Depends(get_session_id),
    db: AsyncSession = Depends(get_database),
) -> ApiResponse[ChordStatsResponse]:
    """Return aggregated statistics over the caller's chord detections.

    Computes:
    - ``most_common``: Top 10 chords ranked by detection count.
    - ``detection_by_quality``: Count and average confidence per quality.
    - ``total_detections``: Total number of the caller's chord records.

    Args:
        session_id: The caller's ``X-Session-ID``; only its detections
            are aggregated.
        db: Injected SQLAlchemy async session.

    Returns:
        ApiResponse containing a ChordStatsResponse.
    """
    is_owned = ChordDetection.session_id == session_id
    total: int = await db.scalar(
        select(func.count()).select_from(ChordDetection).where(is_owned)
    )

    if total == 0:
        return ApiResponse(
            success=True,
            data=ChordStatsResponse(
                most_common=[],
                detection_by_quality=[],
                total_detections=0,
            ),
        )

    most_common_rows = (
        await db.execute(
            select(ChordDetection.chord, func.count().label("cnt"))
            .where(is_owned)
            .group_by(ChordDetection.chord)
            .order_by(func.count().desc())
            .limit(10)
        )
    ).all()
    most_common = [
        ChordCountItem(chord=r.chord, count=r.cnt) for r in most_common_rows
    ]

    quality_rows = (
        await db.execute(
            select(
                ChordDetection.quality,
                func.count().label("cnt"),
                func.avg(ChordDetection.confidence).label("avg_conf"),
            )
            .where(is_owned)
            .group_by(ChordDetection.quality)
            .order_by(func.count().desc())
        )
    ).all()
    detection_by_quality = [
        ChordQualityItem(
            quality=r.quality,
            count=r.cnt,
            avg_confidence=r.avg_conf,
        )
        for r in quality_rows
    ]

    return ApiResponse(
        success=True,
        data=ChordStatsResponse(
            most_common=most_common,
            detection_by_quality=detection_by_quality,
            total_detections=total,
        ),
    )


@router.get("", response_model=PaginatedResponse[ChordRecordResponse])
async def list_chords(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=MAX_PAGE_LIMIT),
    session_id: str = Depends(get_session_id),
    db: AsyncSession = Depends(get_database),
) -> PaginatedResponse[ChordRecordResponse]:
    """List the caller's chord detection records, newest first.

    Args:
        page: 1-based page number (default 1, must be >= 1).
        limit: Maximum items per page (default 20, 1 to MAX_PAGE_LIMIT).
        session_id: The caller's ``X-Session-ID``; only its detections are
            listed and counted.
        db: Injected SQLAlchemy async session.

    Returns:
        PaginatedResponse with chord records and pagination metadata.
    """
    is_owned = ChordDetection.session_id == session_id
    total: int = await db.scalar(
        select(func.count()).select_from(ChordDetection).where(is_owned)
    )
    skip = (page - 1) * limit
    rows = (
        await db.scalars(
            select(ChordDetection)
            .where(is_owned)
            .order_by(ChordDetection.detected_at.desc())
            .offset(skip)
            .limit(limit)
        )
    ).all()
    return PaginatedResponse(
        success=True,
        data=[_serialize(r) for r in rows],
        meta=PaginationMeta(total=total, page=page, limit=limit),
    )
