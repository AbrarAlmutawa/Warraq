"""
Import official Journal Impact Factors into stored journals.

Impact Factors are entered by hand from a licensed JCR export; they are never
scraped or replaced with another metric. Every row must carry the value, its
JCR year and its source, so an unlabelled number can never reach the UI.

CSV columns (header required):
    journal_id,impact_factor,year,source

Only journals already in the database are updated; unknown journal_ids are
reported, never created.

Usage (from apps/api):
    python -m db.import_impact_factors path/to/impact_factors.csv
"""

import csv
import io
import sys
from collections.abc import Callable
from pathlib import Path

from pydantic import BaseModel, Field

from db import get_store
from db.store import Store
from models.journal import JournalRequirementSpec

COLUMNS = ("journal_id", "impact_factor", "year", "source")


class ImpactFactorRow(BaseModel):
    journal_id: str = Field(min_length=1)
    impact_factor: float = Field(ge=0)
    year: int = Field(ge=1975, le=2100)
    source: str = Field(min_length=1)


def parse_rows(text: str) -> list[ImpactFactorRow]:
    """Parse the CSV. Raises ValueError naming the first bad row."""
    reader = csv.DictReader(io.StringIO(text))
    missing = [c for c in COLUMNS if c not in (reader.fieldnames or [])]
    if missing:
        raise ValueError(f"Missing columns: {', '.join(missing)}")

    rows: list[ImpactFactorRow] = []
    for line, raw in enumerate(reader, start=2):
        values = {c: (raw.get(c) or "").strip() for c in COLUMNS}
        empty = [c for c, v in values.items() if not v]
        if empty:
            raise ValueError(f"Row {line}: missing {', '.join(empty)}")
        try:
            rows.append(ImpactFactorRow.model_validate(values))
        except ValueError as exc:
            raise ValueError(f"Row {line}: {exc}") from exc
    return rows


def apply_impact_factors(store: Store, rows: list[ImpactFactorRow]) -> tuple[int, list[str]]:
    """Write the rows onto stored journals. Returns (updated count, unknown journal_ids)."""
    updated = 0
    unknown: list[str] = []
    for row in rows:
        spec = store.get_journal(row.journal_id)
        if spec is None:
            unknown.append(row.journal_id)
            continue
        store.save_journal(
            spec.model_copy(
                update={
                    "impact_factor": row.impact_factor,
                    "impact_factor_year": row.year,
                    "impact_factor_source": row.source,
                }
            )
        )
        updated += 1
    return updated, unknown


def keep_manual_impact_factor(
    store: Store,
) -> Callable[[JournalRequirementSpec], None]:
    """
    Save function for the journal agent that carries a manually entered
    Impact Factor over to the re-scraped spec (save_journal replaces the row).
    """

    def save(spec: JournalRequirementSpec) -> None:
        existing = store.get_journal(spec.journal_id)
        if existing is not None and existing.impact_factor is not None and spec.impact_factor is None:
            spec = spec.model_copy(
                update={
                    "impact_factor": existing.impact_factor,
                    "impact_factor_year": existing.impact_factor_year,
                    "impact_factor_source": existing.impact_factor_source,
                }
            )
        store.save_journal(spec)

    return save


def main() -> None:
    if len(sys.argv) != 2:
        sys.exit("Usage: python -m db.import_impact_factors path/to/impact_factors.csv")
    try:
        rows = parse_rows(Path(sys.argv[1]).read_text(encoding="utf-8-sig"))
    except ValueError as exc:
        sys.exit(f"Nothing imported. {exc}")

    updated, unknown = apply_impact_factors(get_store(), rows)
    print(f"Updated {updated} journal(s).")
    if unknown:
        print(f"Unknown journal_id (not in the database, skipped): {', '.join(unknown)}")


if __name__ == "__main__":
    main()
