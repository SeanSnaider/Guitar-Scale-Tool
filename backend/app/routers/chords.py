"""Chord detection history endpoints.

Stores individual chord detection events from the AI layer and provides
list and aggregated statistics queries.
"""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import ChordDetection, get_database
from ..models.chord import (
    ChordCountItem,
    ChordQualityItem,
    ChordRecordCreate,
    ChordRecordResponse,
    ChordStatsResponse,
)
from ..models.common import ApiResponse, PaginatedResponse, PaginationMeta

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
    db: AsyncSession = Depends(get_database),
) -> ApiResponse[ChordRecordResponse]:
    """Record a single chord detection event.

    The ``detected_at`` timestamp is set server-side to the current UTC time.

    Args:
        body: Chord detection data including chord name, confidence, root,
              quality, and optional session linkage.
        db: Injected SQLAlchemy async session.

    Returns:
        ApiResponse containing the newly stored chord record.
    """
    row = ChordDetection(
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
    db: AsyncSession = Depends(get_database),
) -> ApiResponse[ChordStatsResponse]:
    """Return aggregated chord detection statistics.

    Computes:
    - ``most_common``: Top 10 chords ranked by detection count.
    - ``detection_by_quality``: Count and average confidence per quality.
    - ``total_detections``: Total number of stored chord records.

    Args:
        db: Injected SQLAlchemy async session.

    Returns:
        ApiResponse containing a ChordStatsResponse.
    """
    total: int = await db.scalar(
        select(func.count()).select_from(ChordDetection)
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
    page: int = 1,
    limit: int = 20,
    db: AsyncSession = Depends(get_database),
) -> PaginatedResponse[ChordRecordResponse]:
    """List chord detection records, newest first.

    Args:
        page: 1-based page number (default 1).
        limit: Maximum items per page (default 20).
        db: Injected SQLAlchemy async session.

    Returns:
        PaginatedResponse with chord records and pagination metadata.
    """
    total: int = await db.scalar(
        select(func.count()).select_from(ChordDetection)
    )
    skip = (page - 1) * limit
    rows = (
        await db.scalars(
            select(ChordDetection)
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
