"""
Run this directly to test the agent against a handful of real journal
guideline pages, with zero FastAPI/DB dependency. This is your Days 2-3
loop: run it, look at the printed spec, tweak the extraction prompt/tool
schema, run it again.

Usage:
    python -m apps.api.services.journal_agent.run_local
"""

import uuid

from apps.api.services.journal_agent.graph import _REVIEW_QUEUE, _SPECS, build_dev_graph

# Pick 3-5 journals you'll actually use in the demo's gold DB later.
# Swap these for your real targets.
SAMPLE_JOURNALS = [
    {
        "name": "PLOS ONE",
        "publisher": "PLOS",
        "source_url": "https://journals.plos.org/plosone/s/submission-guidelines",
    },
    {
        "name": "IEEE Access",
        "publisher": "IEEE",
        "source_url": "https://ieeeaccess.ieee.org/authors/submission-guidelines/",
    },
]


def main() -> None:
    graph = build_dev_graph()

    for j in SAMPLE_JOURNALS:
        initial_state = {
            "journal_id": str(uuid.uuid4()),
            "journal_name": j["name"],
            "publisher": j["publisher"],
            "source_url": j["source_url"],
        }
        print(f"\n--- {j['name']} ---")
        result = graph.invoke(initial_state)

        if result.get("needs_review"):
            print(f"FLAGGED for review. Low-confidence fields: {result['low_confidence_fields']}")
            if result.get("scrape_error"):
                print(f"  scrape_error: {result['scrape_error']}")
            if result.get("extract_error"):
                print(f"  extract_error: {result['extract_error']}")
            print(f"  raw_text length: {len(result.get('raw_text', ''))}")
        else:
            print(f"Finalized. Confidence: {result['overall_confidence']:.2f}")
        if result.get("draft_spec"):
            print(result["draft_spec"].model_dump_json(indent=2))

    print(f"\nSpecs saved: {len(_SPECS)} | Flagged for review: {len(_REVIEW_QUEUE)}")


if __name__ == "__main__":
    main()
