"""
Demo journals so the app works before real scraped journals exist.

These are invented journals (is_demo = true) with example rules. They are
only loaded into an EMPTY database, so real journals from the agent are
never overwritten. Replace them with the verified "gold" set before the demo.
"""

import json
from pathlib import Path

from db.store import Store
from models.journal import JournalRequirementSpec

DEMO_JOURNALS_PATH = Path(__file__).parent / "seed" / "demo_journals.json"


def load_demo_journals(path: Path = DEMO_JOURNALS_PATH) -> list[JournalRequirementSpec]:
    data = json.loads(path.read_text(encoding="utf-8"))
    return [JournalRequirementSpec.model_validate(item) for item in data]


def seed_if_empty(store: Store) -> int:
    """Insert the demo journals if there are no journals yet. Returns how many were added."""
    if store.count_journals() > 0:
        return 0
    journals = load_demo_journals()
    for spec in journals:
        store.save_journal(spec)
    return len(journals)
