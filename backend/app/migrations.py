"""Idempotent startup migration that adds per-browser ownership columns.

The project has no Alembic; ``Base.metadata.create_all`` creates missing
tables but never alters existing ones.  Databases created before data was
scoped per browser therefore have:

- ``scale_mastery`` with ``UNIQUE (scale_key)`` and no ``session_id``,
- ``scale_attempts`` and ``chord_detections`` without ``session_id``.

``migrate_session_scoping`` upgrades such tables in place.  SQLite cannot
drop a constraint or add a ``NOT NULL`` column without a default, so each
outdated table is rebuilt with SQLite's documented pattern: create the new
table (DDL taken from the current ORM model), copy the rows, drop the old
table, rename the new one.  All rebuilds run in one ``BEGIN IMMEDIATE``
transaction, so a failure leaves the database exactly as it was.

Ownership of legacy rows:
    Rows written before scoping existed have no owner.  If
    ``practice_sessions`` holds exactly one distinct ``session_id`` (a
    single browser has ever used this database) the legacy rows adopt it,
    so that browser keeps its history.  Otherwise (zero or several
    browsers) there is no way to tell who wrote them and they are assigned
    ``LEGACY_SESSION_ID``; they stay in the database but are invisible to
    every real browser.  Note that a client sending ``X-Session-ID: legacy``
    would see them - acceptable, as this data was globally shared anyway.

Only SQLite (the only configured backend) is supported; on any other
dialect the migration logs a warning and does nothing.

The migration is a no-op on a fresh database and on any database it has
already migrated.
"""
import logging
from dataclasses import dataclass

from sqlalchemy import Connection, MetaData, Table, UniqueConstraint, text
from sqlalchemy.schema import CreateIndex, CreateTable

logger = logging.getLogger(__name__)

# Owner assigned to pre-scoping rows when the real owner cannot be inferred.
LEGACY_SESSION_ID = "legacy"

# Column holding the owning browser's X-Session-ID on every scoped table.
OWNER_COLUMN = "session_id"

# Tables that gained an owner column; practice_sessions always had one.
SCOPED_TABLE_NAMES = ("chord_detections", "scale_mastery", "scale_attempts")

# Table whose distinct owners decide who adopts the legacy rows.
OWNER_SOURCE_TABLE = "practice_sessions"

# Suffix for the temporary table built during a rebuild.
_REBUILD_SUFFIX = "__session_scoping_new"


@dataclass(frozen=True)
class MigrationReport:
    """Summary of what one ``migrate_session_scoping`` run changed.

    Attributes:
        rebuilt_tables: Names of tables rebuilt to the current schema.
        created_indexes: Names of indexes that were missing and created.
        legacy_owner: Session ID assigned to pre-existing rows, or None
            when no table needed rebuilding.
    """

    rebuilt_tables: tuple[str, ...] = ()
    created_indexes: tuple[str, ...] = ()
    legacy_owner: str | None = None

    @property
    def changed(self) -> bool:
        """Whether the run modified the schema at all.

        Returns:
            True if any table was rebuilt or any index created.
        """
        return bool(self.rebuilt_tables or self.created_indexes)


def migrate_session_scoping(conn: Connection, metadata: MetaData) -> MigrationReport:
    """Bring pre-scoping tables up to the current schema, idempotently.

    Must be called on a connection inside ``engine.begin()`` (directly or
    via ``AsyncConnection.run_sync``) with no uncommitted writes, after
    ``metadata.create_all`` has created any missing tables.  The
    surrounding ``begin()`` block commits the migration on success and
    rolls it back on error.

    Args:
        conn: Synchronous SQLAlchemy connection to migrate.
        metadata: Metadata holding the current ORM table definitions.

    Returns:
        A report of the tables rebuilt and indexes created; empty when
        the schema was already current or the dialect is not SQLite.
    """
    if conn.dialect.name != "sqlite":
        logger.warning(
            "Skipping session-scoping migration: dialect %r is not supported "
            "(only SQLite is). Existing tables may lack session_id columns.",
            conn.dialect.name,
        )
        return MigrationReport()

    pending = _tables_needing_rebuild(conn, metadata)
    if pending:
        # Python's sqlite3 module does not open a transaction before DDL on
        # its own, so start one explicitly; IMMEDIATE takes the write lock
        # now so a second process cannot migrate concurrently.  Re-check
        # under the lock in case another process just migrated.
        conn.exec_driver_sql("BEGIN IMMEDIATE")
        pending = _tables_needing_rebuild(conn, metadata)
    legacy_owner = _resolve_legacy_owner(conn) if pending else None
    for table in pending:
        _rebuild_table(conn, table, legacy_owner)
    created_indexes = _create_missing_indexes(conn, metadata)

    report = MigrationReport(
        rebuilt_tables=tuple(table.name for table in pending),
        created_indexes=created_indexes,
        legacy_owner=legacy_owner,
    )
    if report.changed:
        logger.info("Session-scoping migration applied: %s", report)
    return report


def _quote(conn: Connection, identifier: str) -> str:
    """Quote an SQL identifier for the connection's dialect.

    Args:
        conn: Connection whose dialect decides the quoting rules.
        identifier: Table, column or index name.

    Returns:
        The identifier, quoted if the dialect requires it.
    """
    return conn.dialect.identifier_preparer.quote(identifier)


def _table_exists(conn: Connection, table_name: str) -> bool:
    """Check whether a table exists in the SQLite database.

    Args:
        conn: Connection to inspect.
        table_name: Name of the table.

    Returns:
        True if ``sqlite_master`` lists a table with that name.
    """
    found = conn.execute(
        text("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = :name"),
        {"name": table_name},
    ).first()
    return found is not None


def _column_names(conn: Connection, table_name: str) -> set[str]:
    """Return the column names of an existing table.

    Args:
        conn: Connection to inspect.
        table_name: Name of an existing table.

    Returns:
        The set of column names reported by ``PRAGMA table_info``.
    """
    rows = conn.exec_driver_sql(f"PRAGMA table_info({_quote(conn, table_name)})")
    return {row[1] for row in rows}


def _unique_column_sets(conn: Connection, table_name: str) -> set[tuple[str, ...]]:
    """Return the column lists of every non-primary-key unique index.

    Covers both explicit unique indexes and the implicit indexes SQLite
    creates for ``UNIQUE`` table constraints.

    Args:
        conn: Connection to inspect.
        table_name: Name of an existing table.

    Returns:
        One tuple of column names (in index order) per unique index.
    """
    index_rows = conn.exec_driver_sql(
        f"PRAGMA index_list({_quote(conn, table_name)})"
    ).all()
    column_sets: set[tuple[str, ...]] = set()
    for _seq, index_name, is_unique, origin, *_rest in index_rows:
        if not is_unique or origin == "pk":
            continue
        info_rows = conn.exec_driver_sql(
            f"PRAGMA index_info({_quote(conn, index_name)})"
        ).all()
        column_sets.add(tuple(row[2] for row in sorted(info_rows)))
    return column_sets


def _expected_unique_column_sets(table: Table) -> set[tuple[str, ...]]:
    """Return the unique column lists the ORM model declares for a table.

    Args:
        table: Current ORM table definition.

    Returns:
        One tuple of column names per unique constraint or unique index.
    """
    expected = {
        tuple(column.name for column in constraint.columns)
        for constraint in table.constraints
        if isinstance(constraint, UniqueConstraint)
    }
    expected |= {
        tuple(column.name for column in index.columns)
        for index in table.indexes
        if index.unique
    }
    expected |= {(column.name,) for column in table.columns if column.unique}
    return expected


def _tables_needing_rebuild(conn: Connection, metadata: MetaData) -> list[Table]:
    """Find scoped tables whose on-disk schema predates per-browser scoping.

    A table is outdated if it lacks the owner column or carries a unique
    index the current model no longer declares (the old
    ``UNIQUE (scale_key)`` on ``scale_mastery``).

    Args:
        conn: Connection to inspect.
        metadata: Metadata holding the current ORM table definitions.

    Returns:
        The current definitions of every outdated table, in
        ``SCOPED_TABLE_NAMES`` order.
    """
    outdated: list[Table] = []
    for table_name in SCOPED_TABLE_NAMES:
        if not _table_exists(conn, table_name):
            continue
        table = metadata.tables[table_name]
        missing_owner = OWNER_COLUMN not in _column_names(conn, table_name)
        stale_unique = bool(
            _unique_column_sets(conn, table_name) - _expected_unique_column_sets(table)
        )
        if missing_owner or stale_unique:
            outdated.append(table)
    return outdated


def _resolve_legacy_owner(conn: Connection) -> str:
    """Decide which session ID pre-scoping rows should belong to.

    Args:
        conn: Connection to inspect.

    Returns:
        The only distinct ``session_id`` in ``practice_sessions`` if there
        is exactly one; otherwise ``LEGACY_SESSION_ID``.
    """
    if not _table_exists(conn, OWNER_SOURCE_TABLE):
        return LEGACY_SESSION_ID
    owners = conn.execute(
        text(
            f"SELECT DISTINCT {_quote(conn, OWNER_COLUMN)} "
            f"FROM {_quote(conn, OWNER_SOURCE_TABLE)} LIMIT 2"
        )
    ).scalars().all()
    return owners[0] if len(owners) == 1 else LEGACY_SESSION_ID


def _rebuild_table(conn: Connection, table: Table, legacy_owner: str) -> None:
    """Rebuild one table to its current definition, preserving its rows.

    Follows SQLite's create-copy-drop-rename procedure.  Columns present
    in both schemas are copied as-is (primary keys included); the owner
    column is filled with ``legacy_owner`` if the old table lacked it.
    The old table's indexes are dropped with it and recreated afterwards
    by ``_create_missing_indexes``.

    Args:
        conn: Connection inside the migration transaction.
        table: Current ORM definition of the table to rebuild.
        legacy_owner: Session ID for rows that have no owner yet.
    """
    old_columns = _column_names(conn, table.name)
    staging = table.to_metadata(MetaData(), name=f"{table.name}{_REBUILD_SUFFIX}")
    conn.execute(CreateTable(staging))

    shared = [column.name for column in table.columns if column.name in old_columns]
    target_columns = [_quote(conn, name) for name in shared]
    source_values = list(target_columns)
    if OWNER_COLUMN not in old_columns:
        target_columns.append(_quote(conn, OWNER_COLUMN))
        source_values.append(":legacy_owner")

    conn.execute(
        text(
            f"INSERT INTO {_quote(conn, staging.name)} ({', '.join(target_columns)}) "
            f"SELECT {', '.join(source_values)} FROM {_quote(conn, table.name)}"
        ),
        {"legacy_owner": legacy_owner},
    )
    conn.exec_driver_sql(f"DROP TABLE {_quote(conn, table.name)}")
    conn.exec_driver_sql(
        f"ALTER TABLE {_quote(conn, staging.name)} RENAME TO {_quote(conn, table.name)}"
    )


def _create_missing_indexes(conn: Connection, metadata: MetaData) -> tuple[str, ...]:
    """Create any ORM-declared index that is absent from the database.

    ``create_all`` only creates indexes for tables it creates, so indexes
    added to pre-existing tables (e.g. on ``practice_sessions``) and
    indexes dropped by a rebuild are created here.

    Args:
        conn: Connection to modify.
        metadata: Metadata holding the current ORM table definitions.

    Returns:
        Names of the indexes that were created.
    """
    existing = set(
        conn.execute(
            text("SELECT name FROM sqlite_master WHERE type = 'index'")
        ).scalars()
    )
    created: list[str] = []
    for table in metadata.sorted_tables:
        if not _table_exists(conn, table.name):
            continue
        for index in sorted(table.indexes, key=lambda idx: idx.name or ""):
            if index.name in existing:
                continue
            conn.execute(CreateIndex(index))
            created.append(index.name)
    return tuple(created)
