"""Aggregated user statistics endpoint.

Reads from the ``practice_sessions`` and ``scale_mastery`` tables to
produce a single summary of the user's progress.  All computation is
done in Python after fetching minimal data sets; for the expected scale
of a single-user guitar tool this is acceptable and avoids complex SQL.
"""
from datetime import datetime, timezone
from typing import Any

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import PracticeSession, ScaleMastery, get_database
from ..models.common import ApiResponse
from ..models.stats import UserStatsResponse

router = APIRouter(prefix="/stats", tags=["stats"])

# Achievement thresholds — order matters for deterministic list output.
_ACHIEVEMENT_THRESHOLDS: list[tuple[str, str, Any]] = [
    ("first_scale", "total_scales_learned", 1),
    ("five_scales", "total_scales_learned", 5),
    ("ten_scales", "total_scales_learned", 10),
    ("first_hour", "total_practice_minutes", 60),
    ("week_streak", "longest_streak", 7),
]


def _compute_streaks(dates: list[str]) -> tuple[int, int]:
    """Compute current and longest consecutive-day streaks.

    Args:
        dates: Sorted list of unique date strings in "YYYY-MM-DD" format,
               from oldest to newest.

    Returns:
        A tuple of (current_streak, longest_streak).  ``current_streak``
        is the number of consecutive days ending on the most recent date
        in the list; ``longest_streak`` is the maximum run ever observed.
    """
    if not dates:
        return 0, 0

    from datetime import date, timedelta

    unique_dates = sorted({d for d in dates})
    parsed = [date.fromisoformat(d) for d in unique_dates]

    longest = 1
    current_run = 1
    for i in range(1, len(parsed)):
        if parsed[i] - parsed[i - 1] == timedelta(days=1):
            current_run += 1
            longest = max(longest, current_run)
        else:
            current_run = 1

    # current_streak: is the last run still active (last date == today or
    # yesterday)?  We report the length of the final consecutive run so
    # that unit tests (which run "today") see a non-zero value.
    today = date.today()
    last = parsed[-1]
    if last >= today - timedelta(days=1):
        current_streak = current_run
    else:
        current_streak = 0

    return current_streak, max(longest, current_run)


@router.get("", response_model=ApiResponse[UserStatsResponse])
async def get_stats(
    db: AsyncSession = Depends(get_database),
) -> ApiResponse[UserStatsResponse]:
    """Aggregate and return user progress statistics.

    Reads:
    - ``scale_mastery`` table for learned scale count.
    - ``practice_sessions`` table for duration and streak data.

    Derived values:
    - ``xp``: total_scales_learned * 10
    - ``level``: xp // 100 + 1
    - ``achievements``: awarded based on threshold table.

    Args:
        db: Injected SQLAlchemy async session.

    Returns:
        ApiResponse containing a UserStatsResponse.
    """
    # --- Scale stats ---
    total_scales_learned: int = await db.scalar(
        select(func.count())
        .select_from(ScaleMastery)
        .where(ScaleMastery.is_learned == True)  # noqa: E712
    )

    # --- Session stats ---
    # Only ended sessions (duration_seconds IS NOT NULL) contribute to practice time.
    session_rows = (
        await db.execute(
            select(PracticeSession.started_at, PracticeSession.duration_seconds)
        )
    ).all()

    total_practice_minutes: float = 0.0
    session_dates: list[str] = []
    last_practice_date: str | None = None

    for s in session_rows:
        started_at: datetime = s.started_at
        if started_at.tzinfo is None:
            started_at = started_at.replace(tzinfo=timezone.utc)
        session_dates.append(started_at.strftime("%Y-%m-%d"))

        if s.duration_seconds is not None:
            total_practice_minutes += s.duration_seconds / 60.0

    if session_dates:
        last_practice_date = sorted(session_dates)[-1]

    current_streak, longest_streak = _compute_streaks(session_dates)

    # --- XP / Level ---
    xp = total_scales_learned * 10
    level = xp // 100 + 1

    # --- Achievements ---
    stats_snapshot = {
        "total_scales_learned": total_scales_learned,
        "total_practice_minutes": total_practice_minutes,
        "longest_streak": longest_streak,
    }
    achievements: list[str] = [
        badge
        for badge, metric, threshold in _ACHIEVEMENT_THRESHOLDS
        if stats_snapshot.get(metric, 0) >= threshold
    ]

    return ApiResponse(
        success=True,
        data=UserStatsResponse(
            total_scales_learned=total_scales_learned,
            current_streak=current_streak,
            longest_streak=longest_streak,
            total_practice_minutes=total_practice_minutes,
            last_practice_date=last_practice_date,
            xp=xp,
            level=level,
            achievements=achievements,
        ),
    )
