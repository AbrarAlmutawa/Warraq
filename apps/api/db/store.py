"""
Persistence for the Warraq API (S4).

A small SQLite store: each record is kept as validated JSON, so the
Pydantic contracts in models/ stay the single source of truth for shape.
Swapping to Postgres/Supabase later only means reimplementing this class.
"""

import json
import sqlite3
import threading
from contextlib import contextmanager
from pathlib import Path

from models.journal import JournalRequirementSpec, ReviewQueueItem
from models.manuscript import ManuscriptRecord

_SCHEMA = """
CREATE TABLE IF NOT EXISTS manuscripts (
    manuscript_id TEXT PRIMARY KEY,
    content_hash  TEXT NOT NULL UNIQUE,
    data          TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS journals (
    journal_id TEXT PRIMARY KEY,
    name       TEXT NOT NULL,
    data       TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS review_queue (
    journal_id TEXT PRIMARY KEY,
    status     TEXT NOT NULL,
    data       TEXT NOT NULL
);
"""


class Store:
    def __init__(self, database_path: str | Path):
        self.database_path = str(database_path)
        if self.database_path != ":memory:":
            Path(self.database_path).parent.mkdir(parents=True, exist_ok=True)
        self._lock = threading.Lock()
        self._conn = sqlite3.connect(self.database_path, check_same_thread=False)
        self._conn.executescript(_SCHEMA)

    @contextmanager
    def _tx(self):
        with self._lock:
            try:
                yield self._conn
                self._conn.commit()
            except Exception:
                self._conn.rollback()
                raise

    # ---- manuscripts ----

    def save_manuscript(self, record: ManuscriptRecord) -> None:
        with self._tx() as c:
            c.execute(
                "INSERT OR REPLACE INTO manuscripts VALUES (?, ?, ?)",
                (record.manuscript_id, record.content_hash, record.model_dump_json()),
            )

    def get_manuscript(self, manuscript_id: str) -> ManuscriptRecord | None:
        with self._tx() as c:
            row = c.execute(
                "SELECT data FROM manuscripts WHERE manuscript_id = ?", (manuscript_id,)
            ).fetchone()
        return ManuscriptRecord.model_validate_json(row[0]) if row else None

    def get_manuscript_by_hash(self, content_hash: str) -> ManuscriptRecord | None:
        with self._tx() as c:
            row = c.execute(
                "SELECT data FROM manuscripts WHERE content_hash = ?", (content_hash,)
            ).fetchone()
        return ManuscriptRecord.model_validate_json(row[0]) if row else None

    # ---- journals ----

    def save_journal(self, spec: JournalRequirementSpec) -> None:
        """Signature matches the journal agent's SaveSpecFn."""
        with self._tx() as c:
            c.execute(
                "INSERT OR REPLACE INTO journals VALUES (?, ?, ?)",
                (spec.journal_id, spec.name, spec.model_dump_json()),
            )

    def get_journal(self, journal_id: str) -> JournalRequirementSpec | None:
        with self._tx() as c:
            row = c.execute(
                "SELECT data FROM journals WHERE journal_id = ?", (journal_id,)
            ).fetchone()
        return JournalRequirementSpec.model_validate_json(row[0]) if row else None

    def list_journals(self) -> list[JournalRequirementSpec]:
        with self._tx() as c:
            rows = c.execute("SELECT data FROM journals ORDER BY name COLLATE NOCASE").fetchall()
        return [JournalRequirementSpec.model_validate_json(r[0]) for r in rows]

    def count_journals(self) -> int:
        with self._tx() as c:
            return c.execute("SELECT COUNT(*) FROM journals").fetchone()[0]

    # ---- human review queue ----

    def save_review_item(self, item: ReviewQueueItem) -> None:
        """Signature matches the journal agent's EnqueueReviewFn."""
        with self._tx() as c:
            c.execute(
                "INSERT OR REPLACE INTO review_queue VALUES (?, ?, ?)",
                (item.journal_id, item.status, item.model_dump_json()),
            )

    def list_review_items(self, status: str | None = "pending") -> list[ReviewQueueItem]:
        with self._tx() as c:
            if status is None:
                rows = c.execute("SELECT data FROM review_queue").fetchall()
            else:
                rows = c.execute(
                    "SELECT data FROM review_queue WHERE status = ?", (status,)
                ).fetchall()
        return [ReviewQueueItem.model_validate_json(r[0]) for r in rows]
