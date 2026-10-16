"""SQLAlchemy async engine, ORM table definitions, and session dependency.

Defines all four database tables as declarative ORM models, exposes
``connect_db``/``disconnect_db`` for the FastAPI lifespan hook, and
provides ``get_database`` as a FastAPI dependency that yields one
``AsyncSession`` per request.
"""
from collections.abc import AsyncGenerator
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import Boolean, DateTime, Float, Index, Integer, String
from sqlalchemy.types import TypeDecorator
from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

from .config import settings


class UTCDateTime(TypeDecorator):
    """A ``DateTime`` column that always round-trips as timezone-aware UTC.

    SQLite has no timezone support, so a plain ``DateTime`` column silently
    drops ``tzinfo`` and hands back naive datetimes, which then serialise
    without an offset (and browsers read them as local time).  This
    decorator normalises aware values to UTC before storage and re-attaches
    ``timezone.utc`` on load.  The underlying column type is unchanged, so
    there is no schema change and existing rows (stored as naive UTC) load
    correctly.
    """

    impl = DateTime
    cache_ok = True

    def process_bind_param(self, value, dialect):
        """Store as naive UTC (aware values are converted to UTC first)."""
        if value is not None and value.tzinfo is not None:
            value = value.astimezone(timezone.utc).replace(tzinfo=None)
        return value

    def process_result_value(self, value, dialect):
        """Attach UTC to values read back from the database."""
        if value is not None and value.tzinfo is None:
            value = value.replace(tzinfo=timezone.utc)
        return value


class Base(DeclarativeBase):
    """Declarative base shared by all ORM models."""


class PracticeSession(Base):
    """ORM model for a user practice session.

    Tracks the time window, tempo, scales worked on, and optional
    accuracy score for a single uninterrupted practice period.

    Attributes:
        id: Auto-incrementing integer primary key.
        session_id: Client-supplied browser/device session identifier
            (value of the ``X-Session-ID`` request header).
        started_at: UTC datetime when the session began.
        ended_at: UTC datetime when the session ended; NULL if in-progress.
        duration_seconds: Elapsed seconds; NULL until the session ends.
        scales_practiced: JSON-encoded list of scale key strings.
        bpm: Tempo in beats per minute.
        accuracy: Optional 0–1 accuracy score supplied on session end.
    """

    __tablename__ = "practice_sessions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    session_id: Mapped[str] = mapped_column(String, nullable=False)
    started_at: Mapped[datetime] = mapped_column(UTCDateTime, nullable=False)
    ended_at: Mapped[Optional[datetime]] = mapped_column(UTCDateTime, nullable=True)
    duration_seconds: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    scales_practiced: Mapped[str] = mapped_column(
        String, nullable=False, default="[]"
    )
    bpm: Mapped[int] = mapped_column(Integer, nullable=False, default=120)
    accuracy: Mapped[Optional[float]] = mapped_column(Float, nullable=True)


class ChordDetection(Base):
    """ORM model for a single chord detection event.

    Each row represents one chord identified by the AI layer from
    microphone input.

    Attributes:
        id: Auto-incrementing integer primary key.
        chord: Full chord name (e.g. ``"Am7"``).
        confidence: Detection confidence in ``[0.0, 1.0]``.
        root: Root note (e.g. ``"A"``).
        quality: Chord quality string (e.g. ``"minor7"``).
        detected_at: UTC datetime when the detection was stored.
        practice_session_id: Optional stringified ID of the parent session.
    """

    __tablename__ = "chord_detections"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    chord: Mapped[str] = mapped_column(String, nullable=False)
    confidence: Mapped[float] = mapped_column(Float, nullable=False)
    root: Mapped[str] = mapped_column(String, nullable=False)
    quality: Mapped[str] = mapped_column(String, nullable=False)
    detected_at: Mapped[datetime] = mapped_column(UTCDateTime, nullable=False)
    practice_session_id: Mapped[Optional[str]] = mapped_column(
        String, nullable=True
    )


class ScaleMastery(Base):
    """ORM model for per-scale mastery state.

    One row per scale key; updated in-place as the user practices.

    Attributes:
        id: Auto-incrementing integer primary key.
        scale_key: Unique scale identifier (e.g. ``"C_major"``).
        consecutive_correct: Current streak of correct high-BPM attempts.
        is_learned: True once the scale is permanently mastered.
        learned_at: UTC datetime when ``is_learned`` first became True.
        total_attempts: Total attempts recorded across all sessions.
        created_at: UTC datetime when this row was first inserted.
        updated_at: UTC datetime of the most recent update.
    """

    __tablename__ = "scale_mastery"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    scale_key: Mapped[str] = mapped_column(String, nullable=False, unique=True)
    consecutive_correct: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0
    )
    is_learned: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    learned_at: Mapped[Optional[datetime]] = mapped_column(UTCDateTime, nullable=True)
    total_attempts: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(UTCDateTime, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(UTCDateTime, nullable=False)


class ScaleAttemptRow(Base):
    """ORM model for a single scale practice attempt.

    Normalised out of ``ScaleMastery`` so the attempt history can grow
    unboundedly without bloating the mastery row.

    Attributes:
        id: Auto-incrementing integer primary key.
        scale_key: Scale this attempt belongs to; mirrors
            ``ScaleMastery.scale_key``.
        correct: Whether the attempt was judged correct.
        bpm: Tempo at which the attempt was made.
        attempted_at: UTC datetime of the attempt.
        practice_session_id: Optional stringified session ID.
    """

    __tablename__ = "scale_attempts"
    __table_args__ = (Index("ix_scale_attempts_scale_key", "scale_key"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    scale_key: Mapped[str] = mapped_column(String, nullable=False)
    correct: Mapped[bool] = mapped_column(Boolean, nullable=False)
    bpm: Mapped[int] = mapped_column(Integer, nullable=False)
    attempted_at: Mapped[datetime] = mapped_column(UTCDateTime, nullable=False)
    practice_session_id: Mapped[Optional[str]] = mapped_column(
        String, nullable=True
    )


_engine = None
_SessionLocal: async_sessionmaker[AsyncSession] | None = None


async def connect_db() -> None:
    """Create the async engine and initialise the schema.

    Called once during application startup via the lifespan context
    manager.  Creates all tables if they do not yet exist.
    """
    global _engine, _SessionLocal
    _engine = create_async_engine(settings.database_url, echo=False)
    _SessionLocal = async_sessionmaker(_engine, expire_on_commit=False)
    async with _engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def disconnect_db() -> None:
    """Dispose the async engine and release all connection pool resources.

    Called once during application shutdown via the lifespan context
    manager.
    """
    global _engine
    if _engine is not None:
        await _engine.dispose()
        _engine = None


async def get_database() -> AsyncGenerator[AsyncSession, None]:
    """FastAPI dependency that yields one ``AsyncSession`` per request.

    Yields:
        An active ``AsyncSession`` bound to the configured database.

    Raises:
        RuntimeError: If called before ``connect_db`` has been invoked.
    """
    if _SessionLocal is None:
        raise RuntimeError("Database not connected — call connect_db() first")
    async with _SessionLocal() as session:
        yield session
