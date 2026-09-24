"""
Shared schema for journal requirements.

This is the CONTRACT. S3 (matcher) and S4 (backend) read this file too —
do not change field names/types without telling them. If you need to add
a field, add it as Optional with a default so nothing else breaks.
"""

from datetime import datetime, timezone
from enum import Enum

from pydantic import BaseModel, Field


class CitationStyle(str, Enum):
    APA = "apa"
    IEEE = "ieee"
    MLA = "mla"
    CHICAGO = "chicago"
    UNKNOWN = "unknown"


class HardConstraint(BaseModel):
    """Measurable, explicitly-stated rules. No judgment calls here."""

    max_page_count: int | None = None
    max_word_count: int | None = None
    max_title_words: int | None = None
    reference_range: tuple[int, int] | None = None
    required_citation_style: CitationStyle | None = None
    required_template: str | None = None  # "latex" | "word" | "either"

    # --- Added by S4 (contracts v1). All Optional, so existing code is unaffected. ---
    max_abstract_words: int | None = None
    keyword_range: tuple[int, int] | None = None
    max_tables: int | None = None
    max_figures: int | None = None
    highlights_range: tuple[int, int] | None = None  # e.g. (3, 5) bullet points
    # Statements the journal requires, using these ids:
    # "data_availability", "conflict_of_interest", "funding", "ethics"
    required_statements: list[str] = Field(default_factory=list)
    # Section names the journal requires, e.g. ["introduction", "methods", "results", "discussion"]
    required_sections: list[str] = Field(default_factory=list)


class JournalRequirementSpec(BaseModel):
    """
    The single artifact this module exists to produce.
    One instance per journal, written to Postgres (+ pgvector for
    scope_embedding) after every successful scrape.
    """

    journal_id: str
    name: str
    publisher: str
    source_url: str
    hard_constraints: HardConstraint
    scope_embedding: list[float] = Field(default_factory=list)  # dim=1536
    apc_usd: float | None = None
    review_speed_days_avg: int | None = None
    scope_description: str
    extraction_confidence: float = Field(ge=0, le=1)
    needs_human_review: bool = False
    topics: list[str] = Field(default_factory=list)
    accepted_article_types: list[str] = Field(default_factory=list)
    languages: list[str] = Field(default_factory=list)
    access_model: str
    last_scraped_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

    # --- Added by S4 (contracts v1). All Optional with defaults. ---
    short_name: str | None = None  # e.g. "PLOS ONE", "IEEE Access"
    aims: str = ""  # used by the matcher together with scope_description
    indexes: list[str] = Field(default_factory=list)  # e.g. ["scopus", "wos"]
    # Per-field confidence from extraction, keyed by field name
    # (same keys as the extraction tool). Lets the UI show confidence per rule.
    field_confidences: dict[str, float] = Field(default_factory=dict)
    # Short quote from the guideline page that supports each field, keyed by
    # field name. Shown to the researcher as "source" for every rule.
    field_excerpts: dict[str, str] = Field(default_factory=dict)
    # True for hand-made demo journals; False for journals scraped from real pages.
    is_demo: bool = False


class ReviewQueueItem(BaseModel):
    """
    What gets shown to a human when extraction_confidence is below
    threshold. Kept separate from JournalRequirementSpec so the API
    can return "here's what we think, here's why we're unsure."
    """

    journal_id: str
    name: str
    source_url: str
    draft_spec: JournalRequirementSpec | None = None
    low_confidence_fields: list[str]
    raw_extract_notes: str | None = None
    review_notes: str | None = None
    status: str = "pending"  # "pending" | "approved" | "rejected" | "edited"
