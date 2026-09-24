"""
Run the journal agent and save the results into the real database.

Unlike run_local (which keeps results in memory), journals end up in
SQLite, so the API serves them straight away. Confident journals go to
the journals table; uncertain ones go to the review queue.

Usage (from apps/api):
    python -m db.run_agent                      # journals in db/seed/journal_sources.json
    python -m db.run_agent path/to/sources.json # your own list
"""

import json
import re
import sys
from pathlib import Path

from db import get_store
from services.journal_agent.graph import build_graph

DEFAULT_SOURCES = Path(__file__).parent / "seed" / "journal_sources.json"


def journal_id_for(name: str) -> str:
    """Stable id from the name, so re-scraping a journal updates it instead of duplicating it."""
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")


def main() -> None:
    sources_path = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_SOURCES
    sources = json.loads(sources_path.read_text(encoding="utf-8"))

    store = get_store()
    graph = build_graph(store.save_journal, store.save_review_item)

    for source in sources:
        print(f"--- {source['name']} ---")
        result = graph.invoke(
            {
                "journal_id": journal_id_for(source["name"]),
                "journal_name": source["name"],
                "publisher": source["publisher"],
                "source_url": source["source_url"],
            }
        )
        if result.get("needs_review"):
            print(f"  flagged for review: {result.get('low_confidence_fields')}")
            if result.get("scrape_error") or result.get("extract_error"):
                print(f"  error: {result.get('scrape_error') or result.get('extract_error')}")
        else:
            print(f"  saved, confidence {result['overall_confidence']:.2f}")

    print(f"\nJournals in database: {store.count_journals()} | "
          f"Pending review: {len(store.list_review_items('pending'))}")


if __name__ == "__main__":
    main()
