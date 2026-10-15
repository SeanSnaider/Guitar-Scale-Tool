"""Pydantic models for practice session requests and responses.

A practice session tracks the period during which a user is actively
practising, capturing start/end times, which scales were worked on,
tempo, and optional accuracy data.
"""
from datetime import datetime
from typing import Annotated

from pydantic import BaseModel, Field

# Shared bounds for request validation.
BPM_MIN = 20
BPM_MAX = 400
MAX_SCALES_PER_SESSION = 50


class PracticeSessionCreate(BaseModel):
    """Request body for starting a new practice session.

    Attributes:
        scales_practiced: Optional list of scale keys to pre-populate.
        bpm: Starting tempo in beats per minute.
    """

    scales_practiced: list[Annotated[str, Field(min_length=1, max_length=64)]] = Field(
        default_factory=list, max_length=MAX_SCALES_PER_SESSION
    )
    bpm: int = Field(120, ge=BPM_MIN, le=BPM_MAX)


class PracticeSessionEnd(BaseModel):
    """Request body for ending an existing practice session.

    Attributes:
        accuracy: Optional 0-1 accuracy score recorded by the client.
    """

    accuracy: float | None = Field(None, ge=0.0, le=1.0)


class PracticeSessionResponse(BaseModel):
    """Serialised practice session returned by the API.

    Attributes:
        id: String representation of the integer primary key.
        session_id: The browser/client session identifier (X-Session-ID).
        started_at: UTC timestamp when the session was started.
        ended_at: UTC timestamp when the session ended; None if still active.
        duration_seconds: Elapsed time in seconds; None if still active.
        scales_practiced: Scales worked on during this session.
        bpm: Tempo in beats per minute.
        accuracy: Accuracy score if provided on end; None otherwise.
    """

    id: str
    session_id: str
    started_at: datetime
    ended_at: datetime | None = None
    duration_seconds: float | None = None
    scales_practiced: list[str]
    bpm: int
    accuracy: float | None = None
