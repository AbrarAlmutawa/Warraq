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
from models.validation import Suggestion

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
CREATE TABLE IF NOT EXISTS suggestions (
    suggestion_id TEXT PRIMARY KEY,
    manuscript_id TEXT NOT NULL,
    journal_id    TEXT NOT NULL,
    data          TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS suggestions_pair ON suggestions (manuscript_id, journal_id);
CREATE TABLE IF NOT EXISTS suggestion_runs (
    manuscript_id TEXT NOT NULL,
    journal_id    TEXT NOT NULL,
    PRIMARY KEY (manuscript_id, journal_id)
);
CREATE TABLE IF NOT EXISTS llm_cache (
    key  TEXT PRIMARY KEY,
    data TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS llm_calls (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
    task          TEXT NOT NULL,
    model         TEXT NOT NULL,
    status        TEXT NOT NULL,
    cached        INTEGER NOT NULL,
    input_tokens  INTEGER NOT NULL,
    output_tokens INTEGER NOT NULL,
    cost_usd      REAL,
    latency_ms    INTEGER NOT NULL,
    error         TEXT
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

    def get_review_item(self, journal_id: str) -> ReviewQueueItem | None:
        with self._tx() as c:
            row = c.execute(
                "SELECT data FROM review_queue WHERE journal_id = ?", (journal_id,)
            ).fetchone()
        return ReviewQueueItem.model_validate_json(row[0]) if row else None

    def find_journal_conflict(self, spec: JournalRequirementSpec) -> JournalRequirementSpec | None:
        with self._tx() as c:
            rows = c.execute("SELECT data FROM journals").fetchall()
        for row in rows:
            existing = JournalRequirementSpec.model_validate_json(row[0])
            if existing.journal_id == spec.journal_id:
                return existing
            if existing.source_url == spec.source_url:
                return existing
            if existing.name.casefold() == spec.name.casefold():
                return existing
        return None

    def update_review_item(self, item: ReviewQueueItem) -> None:
        with self._tx() as c:
            exists = c.execute(
                "SELECT 1 FROM review_queue WHERE journal_id = ?", (item.journal_id,)
            ).fetchone()
            if not exists:
                raise KeyError(item.journal_id)
            c.execute(
                "UPDATE review_queue SET status = ?, data = ? WHERE journal_id = ?",
                (item.status, item.model_dump_json(), item.journal_id),
            )

    def approve_review_item(self, item: ReviewQueueItem, spec: JournalRequirementSpec) -> None:
        """Atomically promote a reviewed draft into the journal catalog."""
        with self._tx() as c:
            row = c.execute(
                "SELECT data FROM review_queue WHERE journal_id = ?", (item.journal_id,)
            ).fetchone()
            if not row:
                raise KeyError(item.journal_id)
            rows = c.execute("SELECT data FROM journals").fetchall()
            for row in rows:
                existing = JournalRequirementSpec.model_validate_json(row[0])
                if (
                    existing.journal_id == spec.journal_id
                    or existing.name.casefold() == spec.name.casefold()
                    or existing.source_url == spec.source_url
                ):
                    raise ValueError("journal_conflict")
            c.execute(
                "INSERT INTO journals VALUES (?, ?, ?)",
                (spec.journal_id, spec.name, spec.model_dump_json()),
            )
            c.execute(
                "UPDATE review_queue SET status = ?, data = ? WHERE journal_id = ?",
                (item.status, item.model_dump_json(), item.journal_id),
            )

    # ---- AI suggestions (kept so accept/reject decisions survive) ----

    def save_suggestions(self, manuscript_id: str, journal_id: str, items: list[Suggestion]) -> None:
        """Replace the stored suggestions for this manuscript + journal pair."""
        with self._tx() as c:
            c.execute(
                "DELETE FROM suggestions WHERE manuscript_id = ? AND journal_id = ?",
                (manuscript_id, journal_id),
            )
            c.executemany(
                "INSERT OR REPLACE INTO suggestions VALUES (?, ?, ?, ?)",
                [(i.suggestion_id, manuscript_id, journal_id, i.model_dump_json()) for i in items],
            )

    def list_suggestions(self, manuscript_id: str, journal_id: str) -> list[Suggestion] | None:
        """None = never generated for this pair; [] = generated, nothing to suggest."""
        with self._tx() as c:
            rows = c.execute(
                "SELECT data FROM suggestions WHERE manuscript_id = ? AND journal_id = ? ORDER BY rowid",
                (manuscript_id, journal_id),
            ).fetchall()
            marker = c.execute(
                "SELECT 1 FROM suggestion_runs WHERE manuscript_id = ? AND journal_id = ?",
                (manuscript_id, journal_id),
            ).fetchone()
        if not rows and not marker:
            return None
        return [Suggestion.model_validate_json(r[0]) for r in rows]

    def mark_suggestions_generated(self, manuscript_id: str, journal_id: str) -> None:
        with self._tx() as c:
            c.execute(
                "INSERT OR REPLACE INTO suggestion_runs VALUES (?, ?)", (manuscript_id, journal_id)
            )

    def get_suggestion(self, suggestion_id: str) -> Suggestion | None:
        with self._tx() as c:
            row = c.execute(
                "SELECT data FROM suggestions WHERE suggestion_id = ?", (suggestion_id,)
            ).fetchone()
        return Suggestion.model_validate_json(row[0]) if row else None

    def update_suggestion(self, suggestion: Suggestion) -> None:
        with self._tx() as c:
            c.execute(
                "UPDATE suggestions SET data = ? WHERE suggestion_id = ?",
                (suggestion.model_dump_json(), suggestion.suggestion_id),
            )

    # ---- LLM cache and usage log (LLMOps) ----

    def get_llm_cache(self, key: str) -> dict | None:
        with self._tx() as c:
            row = c.execute("SELECT data FROM llm_cache WHERE key = ?", (key,)).fetchone()
        return json.loads(row[0]) if row else None

    def set_llm_cache(self, key: str, data: dict) -> None:
        with self._tx() as c:
            c.execute("INSERT OR REPLACE INTO llm_cache VALUES (?, ?)", (key, json.dumps(data)))

    def log_llm_call(self, log) -> None:
        with self._tx() as c:
            c.execute(
                "INSERT INTO llm_calls (task, model, status, cached, input_tokens, output_tokens,"
                " cost_usd, latency_ms, error) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
                (log.task, log.model, log.status, int(log.cached), log.input_tokens,
                 log.output_tokens, log.cost_usd, log.latency_ms, log.error),
            )

    def llm_usage(self) -> list[dict]:
        """Totals per task and model: what the AI features cost and how reliable they are."""
        with self._tx() as c:
            rows = c.execute(
                """
                SELECT task, model,
                       COUNT(*)                                        AS calls,
                       SUM(cached)                                     AS cached_calls,
                       SUM(CASE WHEN status != 'ok' THEN 1 ELSE 0 END) AS failed_calls,
                       SUM(input_tokens)                               AS input_tokens,
                       SUM(output_tokens)                              AS output_tokens,
                       ROUND(SUM(COALESCE(cost_usd, 0)), 6)            AS cost_usd,
                       CAST(AVG(CASE WHEN cached = 0 AND status = 'ok'
                                THEN latency_ms END) AS INTEGER)       AS avg_latency_ms
                FROM llm_calls GROUP BY task, model ORDER BY task, model
                """
            ).fetchall()
        cols = ["task", "model", "calls", "cached_calls", "failed_calls",
                "input_tokens", "output_tokens", "cost_usd", "avg_latency_ms"]
        return [dict(zip(cols, r)) for r in rows]

    def recent_llm_errors(self, limit: int = 10) -> list[dict]:
        with self._tx() as c:
            rows = c.execute(
                "SELECT created_at, task, model, status, error FROM llm_calls "
                "WHERE status != 'ok' ORDER BY id DESC LIMIT ?", (limit,)
            ).fetchall()
        return [dict(zip(["created_at", "task", "model", "status", "error"], r)) for r in rows]
