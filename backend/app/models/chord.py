"""Pydantic models for chord detection history.

Chord records are appended each time the AI detects a chord from the
microphone. They are owned by the browser (``X-Session-ID``) that recorded
them, can be linked to a practice session, and are used to compute that
browser's detection statistics.
"""
from datetime import datetime

from pydantic import BaseModel, Field


class ChordRecordCreate(BaseModel):
    """Request body for recording a single chord detection event.

    Attributes:
        chord: Full chord name (e.g. "Am7").
        confidence: Detection confidence in the range [0.0, 1.0].
        root: Root note of the chord (e.g. "A").
        quality: Chord quality string (e.g. "minor7").
        practice_session_id: Optional ID of the containing session.
    """

    chord: str
    confidence: float = Field(ge=0.0, le=1.0)
    root: str
    quality: str
    practice_session_id: str | None = None


class ChordRecordResponse(BaseModel):
    """Serialised chord record returned by the API.

    Attributes:
        id: String representation of the integer primary key.
        chord: Full chord name.
        confidence: Detection confidence in [0.0, 1.0].
        root: Root note.
        quality: Chord quality.
        detected_at: UTC timestamp when the detection was stored.
        practice_session_id: Optional parent session identifier.
    """

    id: str
    chord: str
    confidence: float
    root: str
    quality: str
    detected_at: datetime
    practice_session_id: str | None = None


class ChordCountItem(BaseModel):
    """A single row in the most-common-chords ranking.

    Attributes:
        chord: Full chord name.
        count: Number of times this chord was detected.
    """

    chord: str
    count: int


class ChordQualityItem(BaseModel):
    """Aggregated statistics for a single chord quality.

    Attributes:
        quality: Chord quality string.
        count: Total detections for this quality.
        avg_confidence: Mean confidence score across all detections.
    """

    quality: str
    count: int
    avg_confidence: float


class ChordStatsResponse(BaseModel):
    """Aggregated chord detection statistics.

    Attributes:
        most_common: Top chords ranked by detection frequency.
        detection_by_quality: Counts and average confidence per quality.
        total_detections: Total number of the caller's chord records.
    """

    most_common: list[ChordCountItem]
    detection_by_quality: list[ChordQualityItem]
    total_detections: int
