"""Tests for the startup session-scoping migration.

Each test builds a SQLite file in ``tmp_path`` using the exact DDL of the
pre-scoping schema (as found in the developer's ``guitar_learning.db``),
runs ``initialize_schema`` - the same code path ``connect_db`` uses on
startup - and inspects the result with the plain ``sqlite3`` module.
"""
import logging
import sqlite3
from collections.abc import AsyncIterator, Callable
from contextlib import closing
from pathlib import Path
from types import SimpleNamespace

import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy import Connection, Table
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app import migrations
from app.database import Base, get_database, initialize_schema
from app.main import app
from app.migrations import LEGACY_SESSION_ID, MigrationReport, migrate_session_scoping

# Exact DDL of the schema before rows were scoped per browser.
_OLD_SCHEMA_DDL = (
    "CREATE TABLE practice_sessions (id INTEGER NOT NULL, session_id VARCHAR NOT NULL, "
    "started_at DATETIME NOT NULL, ended_at DATETIME, duration_seconds FLOAT, "
    "scales_practiced VARCHAR NOT NULL, bpm INTEGER NOT NULL, accuracy FLOAT, "
    "PRIMARY KEY (id))",
    "CREATE TABLE chord_detections (id INTEGER NOT NULL, chord VARCHAR NOT NULL, "
    "confidence FLOAT NOT NULL, root VARCHAR NOT NULL, quality VARCHAR NOT NULL, "
    "detected_at DATETIME NOT NULL, practice_session_id VARCHAR, PRIMARY KEY (id))",
    "CREATE TABLE scale_mastery (id INTEGER NOT NULL, scale_key VARCHAR NOT NULL, "
    "consecutive_correct INTEGER NOT NULL, is_learned BOOLEAN NOT NULL, "
    "learned_at DATETIME, total_attempts INTEGER NOT NULL, "
    "created_at DATETIME NOT NULL, updated_at DATETIME NOT NULL, "
    "PRIMARY KEY (id), UNIQUE (scale_key))",
    "CREATE TABLE scale_attempts (id INTEGER NOT NULL, scale_key VARCHAR NOT NULL, "
    "correct BOOLEAN NOT NULL, bpm INTEGER NOT NULL, attempted_at DATETIME NOT NULL, "
    "practice_session_id VARCHAR, PRIMARY KEY (id))",
    "CREATE INDEX ix_scale_attempts_scale_key ON scale_attempts (scale_key)",
)

_SCOPED_TABLES = ("chord_detections", "scale_mastery", "scale_attempts")
_ALL_TABLES = ("practice_sessions", *_SCOPED_TABLES)
_OWNER_ID = "9052a9f5-ee3f-4adc-92df-2d7aa2016548"
_OTHER_ID = "0b5e6a7c-1111-4222-8333-444455556666"
_TIMESTAMP = "2026-10-01 12:00:00.000000"


def _build_old_schema_db(path: Path, browser_ids: list[str]) -> None:
    """Create a pre-scoping database with sample rows in every table.

    Args:
        path: File to create.
        browser_ids: One practice session is inserted per entry, owned by
            that ID.  Two chord detections, two mastery rows (``C_major``
            two correct attempts into its streak, ``G_major`` learned) and
            three attempts are always inserted.
    """
    with closing(sqlite3.connect(path)) as conn, conn:
        for statement in _OLD_SCHEMA_DDL:
            conn.execute(statement)
        conn.executemany(
            "INSERT INTO practice_sessions "
            "(session_id, started_at, scales_practiced, bpm) VALUES (?, ?, '[]', 120)",
            [(browser_id, _TIMESTAMP) for browser_id in browser_ids],
        )
        conn.executemany(
            "INSERT INTO chord_detections "
            "(chord, confidence, root, quality, detected_at) VALUES (?, ?, ?, ?, ?)",
            [
                ("Am", 0.9, "A", "minor", _TIMESTAMP),
                ("C", 0.8, "C", "major", _TIMESTAMP),
            ],
        )
        conn.executemany(
            "INSERT INTO scale_mastery (scale_key, consecutive_correct, is_learned, "
            "learned_at, total_attempts, created_at, updated_at) "
            "VALUES (?, ?, ?, ?, ?, ?, ?)",
            [
                ("C_major", 2, 0, None, 2, _TIMESTAMP, _TIMESTAMP),
                ("G_major", 3, 1, _TIMESTAMP, 3, _TIMESTAMP, _TIMESTAMP),
            ],
        )
        conn.executemany(
            "INSERT INTO scale_attempts (scale_key, correct, bpm, attempted_at) "
            "VALUES (?, 1, 120, ?)",
            [("C_major", _TIMESTAMP), ("C_major", _TIMESTAMP), ("G_major", _TIMESTAMP)],
        )


async def _initialize(path: Path) -> MigrationReport:
    """Run the startup schema initialisation against a database file.

    Args:
        path: SQLite file to initialise (created if missing).

    Returns:
        The migration report from ``initialize_schema``.
    """
    engine = create_async_engine(f"sqlite+aiosqlite:///{path.as_posix()}")
    try:
        return await initialize_schema(engine)
    finally:
        await engine.dispose()


def _query(path: Path, sql: str, params: tuple = ()) -> list[tuple]:
    """Run a read query against a database file.

    Args:
        path: SQLite file to read.
        sql: Query to run.
        params: Positional bind parameters.

    Returns:
        All result rows.
    """
    with closing(sqlite3.connect(path)) as conn:
        return conn.execute(sql, params).fetchall()


def _columns(path: Path, table: str) -> list[tuple]:
    """Describe a table's columns as (name, type, notnull, pk) tuples.

    Args:
        path: SQLite file to read.
        table: Table name.

    Returns:
        One tuple per column, in column order.
    """
    return [
        (name, col_type, notnull, pk)
        for _cid, name, col_type, notnull, _default, pk in _query(
            path, f"PRAGMA table_info({table})"
        )
    ]


def _indexes(path: Path, table: str) -> set[tuple[bool, tuple[str, ...]]]:
    """Describe a table's indexes as (is_unique, column names) pairs.

    Index names are ignored because SQLite names constraint indexes
    automatically.

    Args:
        path: SQLite file to read.
        table: Table name.

    Returns:
        The set of index descriptions.
    """
    described = set()
    index_rows = _query(path, f"PRAGMA index_list({table})")
    for _seq, name, unique, _origin, _partial in index_rows:
        columns = tuple(row[2] for row in _query(path, f"PRAGMA index_info({name})"))
        described.add((bool(unique), columns))
    return described


def _owners(path: Path, table: str) -> set[str]:
    """Return the distinct session_id values stored in a table.

    Args:
        path: SQLite file to read.
        table: Table name.

    Returns:
        The set of owners.
    """
    return {row[0] for row in _query(path, f"SELECT DISTINCT session_id FROM {table}")}


def _schema_sql(path: Path) -> list[tuple]:
    """Return every schema object's DDL, for before/after comparisons.

    Args:
        path: SQLite file to read.

    Returns:
        (type, name, sql) rows sorted by name.
    """
    return _query(path, "SELECT type, name, sql FROM sqlite_master ORDER BY name")


def _row_counts(path: Path) -> dict[str, int]:
    """Count the rows in each application table.

    Args:
        path: SQLite file to read.

    Returns:
        Mapping of table name to row count.
    """
    return {t: _query(path, f"SELECT COUNT(*) FROM {t}")[0][0] for t in _ALL_TABLES}


@pytest.fixture
def old_db(tmp_path: Path) -> Path:
    """Return a pre-scoping database used by exactly one browser.

    Args:
        tmp_path: Pytest per-test temporary directory.

    Returns:
        Path to the database file.
    """
    path = tmp_path / "old.db"
    _build_old_schema_db(path, [_OWNER_ID, _OWNER_ID])
    return path


class TestMigrationOfOldSchema:
    """An old-schema database is upgraded to per-browser ownership."""

    async def test_adds_session_id_column_to_every_scoped_table(self, old_db):
        """All three scoped tables gain a NOT NULL session_id column."""
        report = await _initialize(old_db)

        assert report.rebuilt_tables == _SCOPED_TABLES
        for table in _SCOPED_TABLES:
            assert ("session_id", "VARCHAR", 1, 0) in _columns(old_db, table)

    async def test_legacy_rows_adopt_the_only_browser_id(self, old_db):
        """With one distinct browser in practice_sessions, it owns all legacy rows."""
        report = await _initialize(old_db)

        assert report.legacy_owner == _OWNER_ID
        for table in _SCOPED_TABLES:
            assert _owners(old_db, table) == {_OWNER_ID}

    async def test_legacy_rows_get_legacy_owner_when_several_browser_ids(
        self, tmp_path
    ):
        """With several browsers the true owner is unknown, so rows get 'legacy'."""
        path = tmp_path / "shared.db"
        _build_old_schema_db(path, [_OWNER_ID, _OTHER_ID])

        report = await _initialize(path)

        assert report.legacy_owner == LEGACY_SESSION_ID
        for table in _SCOPED_TABLES:
            assert _owners(path, table) == {LEGACY_SESSION_ID}
        assert _owners(path, "practice_sessions") == {_OWNER_ID, _OTHER_ID}

    async def test_legacy_rows_get_legacy_owner_when_no_sessions_exist(self, tmp_path):
        """With no practice sessions at all, rows get 'legacy'."""
        path = tmp_path / "no_sessions.db"
        _build_old_schema_db(path, [])

        report = await _initialize(path)

        assert report.legacy_owner == LEGACY_SESSION_ID
        assert _owners(path, "scale_mastery") == {LEGACY_SESSION_ID}

    async def test_existing_rows_and_ids_are_preserved(self, old_db):
        """Every row survives the rebuild with its primary key and values intact."""
        before_counts = _row_counts(old_db)
        mastery_sql = (
            "SELECT id, scale_key, consecutive_correct, is_learned, learned_at, "
            "total_attempts, created_at, updated_at FROM scale_mastery ORDER BY id"
        )
        before_mastery = _query(old_db, mastery_sql)
        chords_sql = "SELECT id, chord, confidence FROM chord_detections"
        before_chords = _query(old_db, chords_sql)

        await _initialize(old_db)

        assert _row_counts(old_db) == before_counts
        assert _query(old_db, mastery_sql) == before_mastery
        assert _query(old_db, chords_sql) == before_chords

    async def test_old_unique_scale_key_is_replaced_by_per_browser_unique(self, old_db):
        """C_major can exist once per browser, but still only once per browser."""
        await _initialize(old_db)
        insert = (
            "INSERT INTO scale_mastery (session_id, scale_key, consecutive_correct, "
            "is_learned, total_attempts, created_at, updated_at) "
            "VALUES (?, 'C_major', 0, 0, 0, ?, ?)"
        )

        with closing(sqlite3.connect(old_db)) as conn, conn:
            conn.execute(insert, (_OTHER_ID, _TIMESTAMP, _TIMESTAMP))
            with pytest.raises(sqlite3.IntegrityError):
                conn.execute(insert, (_OWNER_ID, _TIMESTAMP, _TIMESTAMP))

        assert (True, ("scale_key",)) not in _indexes(old_db, "scale_mastery")
        assert (True, ("session_id", "scale_key")) in _indexes(old_db, "scale_mastery")

    async def test_session_id_indexes_are_created(self, old_db):
        """Owner-leading indexes exist on every table, and the old one is gone."""
        report = await _initialize(old_db)

        attempt_indexes = _indexes(old_db, "scale_attempts")
        assert (False, ("session_id", "scale_key")) in attempt_indexes
        assert (False, ("scale_key",)) not in attempt_indexes
        chord_indexes = _indexes(old_db, "chord_detections")
        assert (False, ("session_id", "detected_at")) in chord_indexes
        session_indexes = _indexes(old_db, "practice_sessions")
        assert (False, ("session_id", "started_at")) in session_indexes
        assert "ix_practice_sessions_session_id_started_at" in report.created_indexes

    async def test_migrated_schema_matches_a_fresh_database(self, old_db, tmp_path):
        """A migrated database is structurally identical to a newly created one."""
        fresh = tmp_path / "fresh.db"
        await _initialize(fresh)

        await _initialize(old_db)

        for table in _ALL_TABLES:
            assert _columns(old_db, table) == _columns(fresh, table), table
            assert _indexes(old_db, table) == _indexes(fresh, table), table

    async def test_two_browsers_can_record_same_scale_through_api_after_migration(
        self, old_db
    ):
        """End to end: the owner keeps its streak and a new browser starts fresh."""
        await _initialize(old_db)
        engine = create_async_engine(f"sqlite+aiosqlite:///{old_db.as_posix()}")
        session_factory = async_sessionmaker(engine, expire_on_commit=False)

        async def override_get_database() -> AsyncIterator[AsyncSession]:
            """Yield a session bound to the migrated database file."""
            async with session_factory() as session:
                yield session

        app.dependency_overrides[get_database] = override_get_database
        transport = ASGITransport(app=app)
        try:
            async with AsyncClient(
                transport=transport,
                base_url="http://test",
                headers={"X-Session-ID": _OWNER_ID},
            ) as owner, AsyncClient(
                transport=transport,
                base_url="http://test",
                headers={"X-Session-ID": _OTHER_ID},
            ) as newcomer:
                attempt = {"scale_key": "C_major", "bpm": 120, "correct": True}
                newcomer_result = await newcomer.post("/scales/attempt", json=attempt)
                owner_result = await owner.post("/scales/attempt", json=attempt)
                newcomer_learned = await newcomer.get("/scales/learned")
        finally:
            app.dependency_overrides.clear()
            await engine.dispose()

        assert newcomer_result.status_code == 200
        assert newcomer_result.json()["data"]["mastery"]["total_attempts"] == 1
        assert owner_result.status_code == 200
        owner_data = owner_result.json()["data"]
        assert owner_data["mastery"]["total_attempts"] == 3
        assert len(owner_data["mastery"]["attempts"]) == 3
        assert owner_data["just_learned"] is True
        assert newcomer_learned.json()["data"] == []


class TestMigrationIsSafe:
    """The migration is idempotent, a no-op when not needed, and atomic."""

    async def test_second_run_changes_nothing(self, old_db):
        """Running the migration again leaves schema and data untouched."""
        await _initialize(old_db)
        schema_after_first = _schema_sql(old_db)
        counts_after_first = _row_counts(old_db)

        second = await _initialize(old_db)

        assert second == MigrationReport()
        assert second.changed is False
        assert _schema_sql(old_db) == schema_after_first
        assert _row_counts(old_db) == counts_after_first

    async def test_fresh_database_is_a_noop(self, tmp_path):
        """On a new database create_all does everything; migration does nothing."""
        report = await _initialize(tmp_path / "fresh.db")

        assert report == MigrationReport()

    async def test_failure_mid_migration_rolls_back_every_table(
        self, old_db, monkeypatch
    ):
        """If one rebuild fails, tables rebuilt earlier in the run are restored."""
        schema_before = _schema_sql(old_db)
        counts_before = _row_counts(old_db)
        real_rebuild: Callable[[Connection, Table, str], None] = (
            migrations._rebuild_table
        )
        calls: list[str] = []

        def fail_on_second_table(
            conn: Connection, table: Table, legacy_owner: str
        ) -> None:
            """Rebuild the first table normally, then fail."""
            calls.append(table.name)
            if len(calls) > 1:
                raise RuntimeError("simulated failure during rebuild")
            real_rebuild(conn, table, legacy_owner)

        monkeypatch.setattr(migrations, "_rebuild_table", fail_on_second_table)

        with pytest.raises(RuntimeError, match="simulated failure"):
            await _initialize(old_db)

        assert calls == ["chord_detections", "scale_mastery"]
        assert _schema_sql(old_db) == schema_before
        assert _row_counts(old_db) == counts_before

    def test_non_sqlite_dialect_is_skipped_with_warning(self, caplog):
        """Other backends are left alone, with a warning explaining why."""
        fake_conn = SimpleNamespace(dialect=SimpleNamespace(name="postgresql"))

        with caplog.at_level(logging.WARNING, logger="app.migrations"):
            report = migrate_session_scoping(fake_conn, Base.metadata)

        assert report == MigrationReport()
        assert "postgresql" in caplog.text
