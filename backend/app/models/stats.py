"""Pydantic models for aggregated user stats.

A single endpoint aggregates the calling browser's sessions and scale
mastery to produce a summary of its progress including XP, level, and
achievements.
"""
from pydantic import BaseModel


class UserStatsResponse(BaseModel):
    """Aggregated user progress statistics.

    Attributes:
        total_scales_learned: Count of scales where is_learned=True.
        current_streak: Consecutive days (ending today) with a session.
        longest_streak: Maximum consecutive-day streak ever recorded.
        total_practice_minutes: Sum of all ended session durations in minutes.
        last_practice_date: Most recent session date as "YYYY-MM-DD"; None if none.
        xp: Experience points: total_scales_learned * 10.
        level: Player level: xp // 100 + 1.
        achievements: List of earned achievement identifiers.
    """

    total_scales_learned: int
    current_streak: int
    longest_streak: int
    total_practice_minutes: float
    last_practice_date: str | None
    xp: int
    level: int
    achievements: list[str]
