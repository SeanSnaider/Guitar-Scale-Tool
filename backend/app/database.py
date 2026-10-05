"""SQLAlchemy async engine, ORM table definitions, and session dependency.

Defines all four database tables as declarative ORM models, exposes
``connect_db``/``disconnect_db`` for the FastAPI lifespan hook, and
provides ``get_database`` as a FastAPI dependency that yields one
``AsyncSession`` per request.

Every table carries a ``session_id`` column holding the owning browser's
``X-Session-ID``; routers filter every query by it.  Databases created
before that column existed are upgraded in place on startup by
``migrations.migrate_session_scoping`` (see ``initialize_schema``).
"""
from collections.abc import AsyncGenerator
from datetime import datetime
from typing import Optional

from sqlalchemy import (
    Boolean,
    DateTime,
    Float,
    Index,
    Integer,
    String,
    UniqueConstraint,
)
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

from .config import settings
from .migrations import MigrationReport, migrate_session_scoping


class Base(DeclarativeBase):
    """Declarative base shared by all ORM models."""


class PracticeSession(Base):
    """ORM model for a user practice session.

    Tracks the time window, tempo, scales worked on, and optional
    accuracy score for a single uninterrupted practice period.

    Attributes:
        id: Auto-incrementing integer primary key.
        session_id: Client-supplied browser/device session identifier
            (value of the ``X-Session-ID`` request header); the owner.
        started_at: UTC datetime when the session began.
        ended_at: UTC datetime when the session ended; NULL if in-progress.
        duration_seconds: Elapsed seconds; NULL until the session ends.
        scales_practiced: JSON-encoded list of scale key strings.
        bpm: Tempo in beats per minute.
        accuracy: Optional 0–1 accuracy score supplied on session end.
    """

    __tablename__ = "practice_sessions"
    # Serves the per-browser list query (filter by owner, newest first).
    __table_args__ = (
        Index(
            "ix_practice_sessions_session_id_started_at", "session_id", "started_at"
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    session_id: Mapped[str] = mapped_column(String, nullable=False)
    started_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    ended_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
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
        session_id: ``X-Session-ID`` of the browser that recorded the
            detection; all chord queries are filtered by it.
        chord: Full chord name (e.g. ``"Am7"``).
        confidence: Detection confidence in ``[0.0, 1.0]``.
        root: Root note (e.g. ``"A"``).
        quality: Chord quality string (e.g. ``"minor7"``).
        detected_at: UTC datetime when the detection was stored.
        practice_session_id: Optional stringified ID of the parent session.
    """

    __tablename__ = "chord_detections"
    # Serves the per-browser list query (filter by owner, newest first).
    __table_args__ = (
        Index(
            "ix_chord_detections_session_id_detected_at", "session_id", "detected_at"
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    session_id: Mapped[str] = mapped_column(String, nullable=False)
    chord: Mapped[str] = mapped_column(String, nullable=False)
    confidence: Mapped[float] = mapped_column(Float, nullable=False)
    root: Mapped[str] = mapped_column(String, nullable=False)
    quality: Mapped[str] = mapped_column(String, nullable=False)
    detected_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    practice_session_id: Mapped[Optional[str]] = mapped_column(
        String, nullable=True
    )


class ScaleMastery(Base):
    """ORM model for per-scale mastery state.

    One row per (browser, scale key); updated in-place as that browser
    practises.  Uniqueness is on ``(session_id, scale_key)`` so different
    browsers each own an independent row for the same scale.

    Attributes:
        id: Auto-incrementing integer primary key.
        session_id: ``X-Session-ID`` of the owning browser.
        scale_key: Scale identifier (e.g. ``"C_major"``), unique per
            ``session_id``.
        consecutive_correct: Current streak of correct high-BPM attempts.
        is_learned: True once the scale is permanently mastered.
        learned_at: UTC datetime when ``is_learned`` first became True.
        total_attempts: Total attempts this browser has recorded.
        created_at: UTC datetime when this row was first inserted.
        updated_at: UTC datetime of the most recent update.
    """

    __tablename__ = "scale_mastery"
    # The unique constraint's implicit index also serves owner lookups.
    __table_args__ = (
        UniqueConstraint(
            "session_id", "scale_key", name="uq_scale_mastery_session_id_scale_key"
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    session_id: Mapped[str] = mapped_column(String, nullable=False)
    scale_key: Mapped[str] = mapped_column(String, nullable=False)
    consecutive_correct: Mapped[int] = mapped_column(
        Integer, nullable=False, default=0
    )
    is_learned: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    learned_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    total_attempts: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)


class ScaleAttemptRow(Base):
    """ORM model for a single scale practice attempt.

    Normalised out of ``ScaleMastery`` so the attempt history can grow
    unboundedly without bloating the mastery row.

    Attributes:
        id: Auto-incrementing integer primary key.
        session_id: ``X-Session-ID`` of the browser that made the attempt.
        scale_key: Scale this attempt belongs to; together with
            ``session_id`` it identifies the parent ``ScaleMastery`` row.
        correct: Whether the attempt was judged correct.
        bpm: Tempo at which the attempt was made.
        attempted_at: UTC datetime of the attempt.
        practice_session_id: Optional stringified session ID.
    """

    __tablename__ = "scale_attempts"
    # Attempt history is always fetched for one browser's one scale.
    __table_args__ = (
        Index("ix_scale_attempts_session_id_scale_key", "session_id", "scale_key"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    session_id: Mapped[str] = mapped_column(String, nullable=False)
    scale_key: Mapped[str] = mapped_column(String, nullable=False)
    correct: Mapped[bool] = mapped_column(Boolean, nullable=False)
    bpm: Mapped[int] = mapped_column(Integer, nullable=False)
    attempted_at: Mapped[datetime] = mapped_column(DateTime, nullable=False)
    practice_session_id: Mapped[Optional[str]] = mapped_column(
        String, nullable=True
    )


_engine = None
_SessionLocal: async_sessionmaker[AsyncSession] | None = None


async def initialize_schema(engine: AsyncEngine) -> MigrationReport:
    """Create missing tables, then upgrade any pre-scoping tables in place.

    ``create_all`` only creates tables that do not exist yet; it never
    alters existing ones.  The migration step that follows brings tables
    created by older versions of the app up to the current schema and is
    a no-op on a fresh or already-migrated database.

    Args:
        engine: The engine whose database should be initialised.

    Returns:
        What the migration step changed (empty on a no-op run).
    """
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    async with engine.begin() as conn:
        return await conn.run_sync(migrate_session_scoping, Base.metadata)


async def connect_db() -> None:
    """Create the async engine and initialise the schema.

    Called once during application startup via the lifespan context
    manager.  Creates all tables if they do not yet exist and migrates
    tables left over from older schema versions (see
    ``initialize_schema``).
    """
    global _engine, _SessionLocal
    _engine = create_async_engine(settings.database_url, echo=False)
    _SessionLocal = async_sessionmaker(_engine, expire_on_commit=False)
    await initialize_schema(_engine)


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
