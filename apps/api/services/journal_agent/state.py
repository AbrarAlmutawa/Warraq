"""
Agent state. Kept as a plain TypedDict per LangGraph convention —
every node reads/writes a subset of these keys.
"""

from typing import TypedDict

from apps.api.models.journal import JournalRequirementSpec


class AgentState(TypedDict, total=False):
    # input
    journal_id: str
    journal_name: str
    publisher: str
    source_url: str

    # after scrape_node
    raw_html: str
    raw_text: str
    scrape_error: str | None

    # after extract_node
    draft_spec: JournalRequirementSpec | None
    field_confidences: dict[str, float]  # per-field confidence from the LLM
    extract_error: str | None

    # after confidence_check_node
    overall_confidence: float
    needs_review: bool
    low_confidence_fields: list[str]
