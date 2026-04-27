"""Pydantic models for scale mastery tracking.

Each scale a user practises has a single mastery document that accumulates
all attempts. A scale is considered "learned" once the user achieves three
consecutive correct attempts at or above 120 BPM.
"""
from datetime import datetime

from pydantic import BaseModel


class ScaleAttemptCreate(BaseModel):
    """Request body for recording a single scale practice attempt.

    Attributes:
        scale_key: Identifier for the scale (e.g. "C_major").
        bpm: Tempo at which the scale was attempted.
        correct: Whether the attempt was judged correct.
        practice_session_id: Optional ID of the containing session.
    """

    scale_key: str
    bpm: int
    correct: bool
    practice_session_id: str | None = None


class ScaleAttempt(BaseModel):
    """A single scale practice attempt returned within a mastery response.

    Attributes:
        correct: Whether this individual attempt was correct.
        bpm: Tempo for this attempt.
        attempted_at: UTC timestamp of the attempt.
        practice_session_id: Optional parent session identifier.
    """

    correct: bool
    bpm: int
    attempted_at: datetime
    practice_session_id: str | None = None


class ScaleMasteryResponse(BaseModel):
    """Full mastery document returned by the API.

    Attributes:
        id: String representation of the integer primary key.
        scale_key: Identifier for the scale.
        attempts: Full history of individual attempts.
        consecutive_correct: Current streak of correct attempts at 120+ BPM.
        is_learned: True once the scale is mastered (sticky).
        learned_at: UTC timestamp when `is_learned` first became True.
        total_attempts: Convenience count of all attempts.
        created_at: UTC timestamp when the document was first created.
        updated_at: UTC timestamp of the most recent update.
    """

    id: str
    scale_key: str
    attempts: list[ScaleAttempt]
    consecutive_correct: int
    is_learned: bool
    learned_at: datetime | None = None
    total_attempts: int
    created_at: datetime
    updated_at: datetime


class ScaleAttemptResponse(BaseModel):
    """Response returned after recording a scale attempt.

    Attributes:
        mastery: The full updated mastery document.
        just_learned: True only when this attempt caused the scale to
            transition from unlearned to learned.
    """

    mastery: ScaleMasteryResponse
    just_learned: bool
