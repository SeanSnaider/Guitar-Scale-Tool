"""Scale mastery tracking endpoints.

Implements the attempt recording business logic (consecutive correct,
learned threshold, stickiness) and query routes for mastery documents.

Business rules for is_learned:
- A scale becomes learned when consecutive_correct >= 3 AND bpm >= 120.
- Once learned, is_learned is permanently True (sticky).
- An incorrect attempt resets consecutive_correct to 0 but does NOT
  clear is_learned if it was already set.
"""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import ScaleAttemptRow, ScaleMastery, get_database
from ..models.common import ApiResponse
from ..models.scale import (
    ScaleAttempt,
    ScaleAttemptCreate,
    ScaleAttemptResponse,
    ScaleMasteryResponse,
)

# Scale mastery is shared across all clients (the table has no owner
# column); only /sessions is scoped to the caller's X-Session-ID.
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
        attempt_rows: All ScaleAttemptRow rows for this scale_key, ordered
            oldest first.

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
    db: AsyncSession, scale_key: str
) -> list[ScaleAttemptRow]:
    """Fetch all attempt rows for a given scale_key ordered by attempted_at.

    Args:
        db: Active async session.
        scale_key: The scale identifier to query.

    Returns:
        List of ScaleAttemptRow rows ordered oldest first.
    """
    return (
        await db.scalars(
            select(ScaleAttemptRow)
            .where(ScaleAttemptRow.scale_key == scale_key)
            .order_by(ScaleAttemptRow.attempted_at)
        )
    ).all()


async def _apply_attempt(
    db: AsyncSession, body: ScaleAttemptCreate, now: datetime
) -> tuple[ScaleMastery, bool]:
    """Stage one attempt and its mastery update on ``db`` (no commit).

    Args:
        db: Active async session.
        body: The attempt being recorded.
        now: Timestamp to use for the attempt and mastery update.

    Returns:
        A tuple of (mastery row, just_learned flag).
    """
    existing: ScaleMastery | None = await db.scalar(
        select(ScaleMastery).where(ScaleMastery.scale_key == body.scale_key)
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
        scale_key=body.scale_key,
        correct=body.correct,
        bpm=body.bpm,
        attempted_at=now,
        practice_session_id=body.practice_session_id,
    )
    db.add(attempt_row)

    if existing is None:
        mastery = ScaleMastery(
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

    return mastery, just_learned


@router.post("/attempt", response_model=ApiResponse[ScaleAttemptResponse])
async def record_attempt(
    body: ScaleAttemptCreate,
    db: AsyncSession = Depends(get_database),
) -> ApiResponse[ScaleAttemptResponse]:
    """Record a single scale practice attempt and update mastery state.

    Business logic applied in order:
    1. Insert a new ScaleAttemptRow.
    2. If correct and bpm >= 120: increment consecutive_correct.
       Otherwise: reset consecutive_correct to 0.
    3. If the scale is not yet learned and consecutive_correct >= 3:
       set is_learned=True, learned_at=now, just_learned=True.
    4. is_learned is sticky — an incorrect attempt cannot clear it.

    Args:
        body: Attempt details including scale_key, bpm, correct flag.
        db: Injected SQLAlchemy async session.

    Returns:
        ApiResponse containing the updated mastery document and
        just_learned flag.
    """
    now = datetime.now(timezone.utc)

    mastery, just_learned = await _apply_attempt(db, body, now)
    try:
        await db.commit()
    except IntegrityError:
        # Two concurrent first attempts on a new scale_key can both see no
        # mastery row and both INSERT; the loser violates the UNIQUE
        # constraint on scale_key.  Roll back, re-read (the row now exists)
        # and apply this attempt once as an update.
        await db.rollback()
        mastery, just_learned = await _apply_attempt(db, body, now)
        await db.commit()
    await db.refresh(mastery)

    attempt_rows = await _fetch_attempts(db, body.scale_key)
    return ApiResponse(
        success=True,
        data=ScaleAttemptResponse(
            mastery=_serialize_mastery(mastery, attempt_rows),
            just_learned=just_learned,
        ),
    )


@router.get("/learned", response_model=ApiResponse[list[ScaleMasteryResponse]])
async def get_learned_scales(
    db: AsyncSession = Depends(get_database),
) -> ApiResponse[list[ScaleMasteryResponse]]:
    """Return all mastery documents where is_learned is True.

    Args:
        db: Injected SQLAlchemy async session.

    Returns:
        ApiResponse containing the list of learned scale mastery records.
    """
    rows = (
        await db.scalars(
            select(ScaleMastery).where(ScaleMastery.is_learned == True)  # noqa: E712
        )
    ).all()
    result = []
    for row in rows:
        attempt_rows = await _fetch_attempts(db, row.scale_key)
        result.append(_serialize_mastery(row, attempt_rows))
    return ApiResponse(success=True, data=result)


@router.get("/mastery", response_model=ApiResponse[list[ScaleMasteryResponse]])
async def get_all_mastery(
    db: AsyncSession = Depends(get_database),
) -> ApiResponse[list[ScaleMasteryResponse]]:
    """Return all scale mastery documents regardless of learned status.

    Args:
        db: Injected SQLAlchemy async session.

    Returns:
        ApiResponse containing every mastery record.
    """
    rows = (await db.scalars(select(ScaleMastery))).all()
    result = []
    for row in rows:
        attempt_rows = await _fetch_attempts(db, row.scale_key)
        result.append(_serialize_mastery(row, attempt_rows))
    return ApiResponse(success=True, data=result)


@router.get(
    "/mastery/{scale_key}",
    response_model=ApiResponse[ScaleMasteryResponse],
)
async def get_mastery_by_key(
    scale_key: str,
    db: AsyncSession = Depends(get_database),
) -> ApiResponse[ScaleMasteryResponse]:
    """Return the mastery document for a specific scale key.

    Args:
        scale_key: The scale identifier (e.g. "C_major").
        db: Injected SQLAlchemy async session.

    Returns:
        ApiResponse containing the mastery document.

    Raises:
        HTTPException: 404 if no mastery document exists for that key.
    """
    row = await db.scalar(
        select(ScaleMastery).where(ScaleMastery.scale_key == scale_key)
    )
    if row is None:
        raise HTTPException(status_code=404, detail="Scale mastery not found")
    attempt_rows = await _fetch_attempts(db, scale_key)
    return ApiResponse(success=True, data=_serialize_mastery(row, attempt_rows))
