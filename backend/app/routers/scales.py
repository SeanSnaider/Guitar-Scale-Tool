"""Scale mastery tracking endpoints.

Implements the attempt recording business logic (consecutive correct,
learned threshold, stickiness) and query routes for mastery documents.

Mastery is tracked per browser: each ``X-Session-ID`` has its own mastery
row per scale key and its own attempt history, and every route only reads
or writes the caller's rows.

Business rules for is_learned:
- A scale becomes learned when consecutive_correct >= 3 AND bpm >= 120.
- Once learned, is_learned is permanently True (sticky).
- An incorrect attempt resets consecutive_correct to 0 but does NOT
  clear is_learned if it was already set.
"""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import ScaleAttemptRow, ScaleMastery, get_database
from ..dependencies import get_session_id
from ..models.common import ApiResponse
from ..models.scale import (
    ScaleAttempt,
    ScaleAttemptCreate,
    ScaleAttemptResponse,
    ScaleMasteryResponse,
)

router = APIRouter(prefix="/scales", tags=["scales"])

# Minimum BPM required to count towards the learned threshold.
_LEARNED_BPM_THRESHOLD = 120

# Number of consecutive correct attempts (at or above the BPM threshold)
# required to mark a scale as learned.
_CONSECUTIVE_THRESHOLD = 3


def _serialize_mastery(
    row: ScaleMastery, attempt_rows: list[ScaleAttemptRow]
) -> ScaleMasteryResponse:
    """Convert a ScaleMastery ORM row and its attempts to a ScaleMasteryResponse.

    Args:
        row: ORM row from the scale_mastery table.
        attempt_rows: The owning browser's ScaleAttemptRow rows for this
            scale_key, ordered oldest first.

    Returns:
        A validated ScaleMasteryResponse instance.
    """
    attempts = [
        ScaleAttempt(
            correct=a.correct,
            bpm=a.bpm,
            attempted_at=a.attempted_at,
            practice_session_id=a.practice_session_id,
        )
        for a in attempt_rows
    ]
    return ScaleMasteryResponse(
        id=str(row.id),
        scale_key=row.scale_key,
        attempts=attempts,
        consecutive_correct=row.consecutive_correct,
        is_learned=row.is_learned,
        learned_at=row.learned_at,
        total_attempts=row.total_attempts,
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


async def _fetch_attempts(
    db: AsyncSession, session_id: str, scale_key: str
) -> list[ScaleAttemptRow]:
    """Fetch one browser's attempt rows for a scale, ordered by attempted_at.

    Args:
        db: Active async session.
        session_id: The owning browser's ``X-Session-ID``.
        scale_key: The scale identifier to query.

    Returns:
        List of ScaleAttemptRow rows ordered oldest first.
    """
    return (
        await db.scalars(
            select(ScaleAttemptRow)
            .where(
                ScaleAttemptRow.session_id == session_id,
                ScaleAttemptRow.scale_key == scale_key,
            )
            .order_by(ScaleAttemptRow.attempted_at)
        )
    ).all()


async def _serialize_with_attempts(
    db: AsyncSession, rows: list[ScaleMastery]
) -> list[ScaleMasteryResponse]:
    """Serialise mastery rows, attaching each row's own attempt history.

    Args:
        db: Active async session.
        rows: Mastery rows to serialise.

    Returns:
        One ScaleMasteryResponse per row, in the same order.
    """
    result = []
    for row in rows:
        attempt_rows = await _fetch_attempts(db, row.session_id, row.scale_key)
        result.append(_serialize_mastery(row, attempt_rows))
    return result


@router.post("/attempt", response_model=ApiResponse[ScaleAttemptResponse])
async def record_attempt(
    body: ScaleAttemptCreate,
    session_id: str = Depends(get_session_id),
    db: AsyncSession = Depends(get_database),
) -> ApiResponse[ScaleAttemptResponse]:
    """Record a scale practice attempt and update the caller's mastery state.

    Business logic applied in order:
    1. Insert a new ScaleAttemptRow owned by the caller.
    2. If correct and bpm >= 120: increment consecutive_correct.
       Otherwise: reset consecutive_correct to 0.
    3. If the scale is not yet learned and consecutive_correct >= 3:
       set is_learned=True, learned_at=now, just_learned=True.
    4. is_learned is sticky — an incorrect attempt cannot clear it.

    Only the caller's own mastery row for ``scale_key`` is read or
    updated; other browsers' progress on the same scale is unaffected.

    Args:
        body: Attempt details including scale_key, bpm, correct flag.
        session_id: The caller's ``X-Session-ID``.
        db: Injected SQLAlchemy async session.

    Returns:
        ApiResponse containing the updated mastery document and
        just_learned flag.
    """
    now = datetime.now(timezone.utc)

    existing: ScaleMastery | None = await db.scalar(
        select(ScaleMastery).where(
            ScaleMastery.session_id == session_id,
            ScaleMastery.scale_key == body.scale_key,
        )
    )

    was_learned = existing.is_learned if existing else False
    current_consecutive = existing.consecutive_correct if existing else 0

    # Determine new consecutive count.
    if body.correct and body.bpm >= _LEARNED_BPM_THRESHOLD:
        new_consecutive = current_consecutive + 1
    else:
        new_consecutive = 0

    # Determine whether the scale is now learned.
    just_learned = False
    now_learned = was_learned  # Preserve sticky flag.
    learned_at = existing.learned_at if existing else None

    if not was_learned and new_consecutive >= _CONSECUTIVE_THRESHOLD:
        now_learned = True
        learned_at = now
        just_learned = True

    attempt_row = ScaleAttemptRow(
        session_id=session_id,
        scale_key=body.scale_key,
        correct=body.correct,
        bpm=body.bpm,
        attempted_at=now,
        practice_session_id=body.practice_session_id,
    )
    db.add(attempt_row)

    if existing is None:
        mastery = ScaleMastery(
            session_id=session_id,
            scale_key=body.scale_key,
            consecutive_correct=new_consecutive,
            is_learned=now_learned,
            learned_at=learned_at,
            total_attempts=1,
            created_at=now,
            updated_at=now,
        )
        db.add(mastery)
    else:
        existing.consecutive_correct = new_consecutive
        existing.is_learned = now_learned
        existing.learned_at = learned_at
        existing.total_attempts = existing.total_attempts + 1
        existing.updated_at = now
        mastery = existing

    await db.commit()
    await db.refresh(mastery)

    attempt_rows = await _fetch_attempts(db, session_id, body.scale_key)
    return ApiResponse(
        success=True,
        data=ScaleAttemptResponse(
            mastery=_serialize_mastery(mastery, attempt_rows),
            just_learned=just_learned,
        ),
    )


@router.get("/learned", response_model=ApiResponse[list[ScaleMasteryResponse]])
async def get_learned_scales(
    session_id: str = Depends(get_session_id),
    db: AsyncSession = Depends(get_database),
) -> ApiResponse[list[ScaleMasteryResponse]]:
    """Return the caller's mastery documents where is_learned is True.

    Args:
        session_id: The caller's ``X-Session-ID``.
        db: Injected SQLAlchemy async session.

    Returns:
        ApiResponse containing the list of learned scale mastery records.
    """
    rows = (
        await db.scalars(
            select(ScaleMastery).where(
                ScaleMastery.session_id == session_id,
                ScaleMastery.is_learned == True,  # noqa: E712
            )
        )
    ).all()
    return ApiResponse(success=True, data=await _serialize_with_attempts(db, rows))


@router.get("/mastery", response_model=ApiResponse[list[ScaleMasteryResponse]])
async def get_all_mastery(
    session_id: str = Depends(get_session_id),
    db: AsyncSession = Depends(get_database),
) -> ApiResponse[list[ScaleMasteryResponse]]:
    """Return all of the caller's scale mastery documents, learned or not.

    Args:
        session_id: The caller's ``X-Session-ID``.
        db: Injected SQLAlchemy async session.

    Returns:
        ApiResponse containing every mastery record the caller owns.
    """
    rows = (
        await db.scalars(
            select(ScaleMastery).where(ScaleMastery.session_id == session_id)
        )
    ).all()
    return ApiResponse(success=True, data=await _serialize_with_attempts(db, rows))


@router.get(
    "/mastery/{scale_key}",
    response_model=ApiResponse[ScaleMasteryResponse],
)
async def get_mastery_by_key(
    scale_key: str,
    session_id: str = Depends(get_session_id),
    db: AsyncSession = Depends(get_database),
) -> ApiResponse[ScaleMasteryResponse]:
    """Return the caller's mastery document for a specific scale key.

    Args:
        scale_key: The scale identifier (e.g. "C_major").
        session_id: The caller's ``X-Session-ID``.
        db: Injected SQLAlchemy async session.

    Returns:
        ApiResponse containing the mastery document.

    Raises:
        HTTPException: 404 if the caller has no mastery document for that
            key (even if another browser does).
    """
    row = await db.scalar(
        select(ScaleMastery).where(
            ScaleMastery.session_id == session_id,
            ScaleMastery.scale_key == scale_key,
        )
    )
    if row is None:
        raise HTTPException(status_code=404, detail="Scale mastery not found")
    attempt_rows = await _fetch_attempts(db, session_id, scale_key)
    return ApiResponse(success=True, data=_serialize_mastery(row, attempt_rows))
